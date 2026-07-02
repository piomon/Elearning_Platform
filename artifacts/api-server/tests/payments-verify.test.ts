import { describe, it, expect, vi, afterEach } from "vitest";

// Enable Paynow BEFORE any module (env.ts via app.ts) is evaluated so the verify
// endpoint takes its real "pull status from Paynow" branch instead of the
// unconfigured short-circuit. vi.hoisted runs above the static imports below and
// after tests/setup.ts has cleared the host PAYNOW_* secrets.
vi.hoisted(() => {
  process.env.PAYNOW_API_KEY = "test-paynow-api-key";
  process.env.PAYNOW_SIGNATURE_KEY = "test-paynow-signature-key-abc";
});

import request from "supertest";
import { and, eq } from "drizzle-orm";
import { db, payments, accessGrants } from "@workspace/db";
import app from "../src/app";
import { createUser, seedCourse } from "./helpers/factories";

// fetchPaynowStatus() uses the global fetch. Each test stubs it to simulate a
// Paynow status response; afterEach restores the real fetch.
function mockPaynowStatus(status: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status }),
    })),
  );
}

function mockPaynowNetworkError() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("network down");
    }),
  );
}

async function createPendingPayment(userId: number, courseId: number) {
  const [payment] = await db
    .insert(payments)
    .values({
      userId,
      provider: "paynow",
      amount: 3500,
      currency: "PLN",
      status: "pending",
      courseId,
      providerPaymentId: "PAYNOW-EXT-1",
    })
    .returning();
  return payment;
}

async function activeGrantCount(userId: number, courseId: number) {
  const grants = await db
    .select()
    .from(accessGrants)
    .where(and(eq(accessGrants.userId, userId), eq(accessGrants.courseId, courseId)));
  return grants.filter((g) => g.status === "active").length;
}

function verify(paymentId: number | string, token?: string) {
  const req = request(app).post(`/api/payments/${paymentId}/verify`);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.send();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /payments/:id/verify — Paynow reconciliation", () => {
  it("requires authentication (401)", async () => {
    const res = await verify(1);
    expect(res.status).toBe(401);
  });

  it("rejects a non-numeric id (400)", async () => {
    const { token } = await createUser();
    const res = await verify("abc", token);
    expect(res.status).toBe(400);
  });

  it("returns 404 for another user's payment (no id leak)", async () => {
    const owner = await createUser();
    const other = await createUser();
    const { course } = await seedCourse();
    const payment = await createPendingPayment(owner.user.id, course.id);

    const res = await verify(payment.id, other.token);
    expect(res.status).toBe(404);
  });

  it("CONFIRMED completes the payment and grants course access", async () => {
    const { user, token } = await createUser();
    const { course, topic } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);
    mockPaynowStatus("CONFIRMED");

    const before = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(before.status).toBe(403);

    const res = await verify(payment.id, token);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");

    const [updated] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    expect(updated.status).toBe("completed");
    expect(await activeGrantCount(user.id, course.id)).toBe(1);

    const after = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(200);
  });

  it("PENDING keeps the payment pending and grants nothing", async () => {
    const { user, token } = await createUser();
    const { course } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);
    mockPaynowStatus("PENDING");

    const res = await verify(payment.id, token);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");

    const [updated] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    expect(updated.status).toBe("pending");
    expect(await activeGrantCount(user.id, course.id)).toBe(0);
  });

  it("REJECTED marks the payment failed and grants nothing", async () => {
    const { user, token } = await createUser();
    const { course } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);
    mockPaynowStatus("REJECTED");

    const res = await verify(payment.id, token);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");

    const [updated] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    expect(updated.status).toBe("failed");
    expect(await activeGrantCount(user.id, course.id)).toBe(0);
  });

  it("a network error leaves the payment pending (never wrongly fails)", async () => {
    const { user, token } = await createUser();
    const { course } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);
    mockPaynowNetworkError();

    const res = await verify(payment.id, token);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");

    const [updated] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    expect(updated.status).toBe("pending");
  });

  it("is idempotent: re-verifying a completed payment keeps a single grant", async () => {
    const { user, token } = await createUser();
    const { course } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);
    mockPaynowStatus("CONFIRMED");

    const first = await verify(payment.id, token);
    expect(first.body.status).toBe("completed");

    // The second call short-circuits on the local "completed" status.
    const second = await verify(payment.id, token);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("completed");

    expect(await activeGrantCount(user.id, course.id)).toBe(1);
  });
});
