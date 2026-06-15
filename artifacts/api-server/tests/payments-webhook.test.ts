import { describe, it, expect, vi } from "vitest";

// Configure Paynow BEFORE any module (env.ts, app.ts) is evaluated so the
// webhook runs its real HMAC signature-verification path instead of the
// dev/test mock branch. vi.hoisted runs above the static imports below.
const SIGNATURE_KEY = "test-paynow-signature-key-abc";
vi.hoisted(() => {
  process.env.PAYNOW_API_KEY = "test-paynow-api-key";
  process.env.PAYNOW_SIGNATURE_KEY = "test-paynow-signature-key-abc";
});

import crypto from "crypto";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import { db, payments, accessGrants } from "@workspace/db";
import app from "../src/app";
import { createUser, seedCourse } from "./helpers/factories";

function sign(rawBody: string): string {
  return crypto.createHmac("sha256", SIGNATURE_KEY).update(rawBody).digest("base64");
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

function postWebhook(body: object, signature?: string) {
  const raw = JSON.stringify(body);
  const req = request(app)
    .post("/api/payments/webhook")
    .set("Content-Type", "application/json");
  if (signature !== undefined) req.set("Signature", signature);
  return req.send(raw);
}

async function activeGrantCount(userId: number, courseId: number) {
  const grants = await db
    .select()
    .from(accessGrants)
    .where(and(eq(accessGrants.userId, userId), eq(accessGrants.courseId, courseId)));
  return grants.filter((g) => g.status === "active").length;
}

describe("POST /payments/webhook — signature verification", () => {
  it("rejects a webhook without a Signature header (400)", async () => {
    const { user } = await createUser();
    const { course } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);

    const res = await postWebhook({
      externalId: String(payment.id),
      paymentId: "PAYNOW-EXT-1",
      status: "CONFIRMED",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a webhook with an invalid signature (400)", async () => {
    const { user } = await createUser();
    const { course } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);

    const res = await postWebhook(
      { externalId: String(payment.id), paymentId: "PAYNOW-EXT-1", status: "CONFIRMED" },
      "not-a-valid-signature",
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown externalId", async () => {
    const body = { externalId: "99999999", paymentId: "PAYNOW-EXT-1", status: "CONFIRMED" };
    const res = await postWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(404);
  });
});

describe("POST /payments/webhook — status mapping & access", () => {
  it("CONFIRMED with a valid signature completes the payment and grants access", async () => {
    const { user, token } = await createUser();
    const { course, topic } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);

    const before = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(before.status).toBe(403);

    const body = {
      externalId: String(payment.id),
      paymentId: "PAYNOW-EXT-1",
      status: "CONFIRMED",
    };
    const res = await postWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(200);

    const [updated] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    expect(updated.status).toBe("completed");

    const after = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(200);
  });

  it("is idempotent: a repeated CONFIRMED keeps one active grant", async () => {
    const { user } = await createUser();
    const { course } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);

    const body = {
      externalId: String(payment.id),
      paymentId: "PAYNOW-EXT-1",
      status: "CONFIRMED",
    };
    const signature = sign(JSON.stringify(body));

    const first = await postWebhook(body, signature);
    expect(first.status).toBe(200);
    const second = await postWebhook(body, signature);
    expect(second.status).toBe(200);

    expect(await activeGrantCount(user.id, course.id)).toBe(1);
  });

  it("NEW/PENDING is acknowledged without granting access", async () => {
    const { user } = await createUser();
    const { course } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);

    const body = {
      externalId: String(payment.id),
      paymentId: "PAYNOW-EXT-1",
      status: "PENDING",
    };
    const res = await postWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(200);

    const [updated] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    expect(updated.status).toBe("pending");
    expect(await activeGrantCount(user.id, course.id)).toBe(0);
  });

  it("a REJECTED payment is marked failed and does not unlock the course", async () => {
    const { user, token } = await createUser();
    const { course, topic } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);

    const body = {
      externalId: String(payment.id),
      paymentId: "PAYNOW-EXT-1",
      status: "REJECTED",
    };
    const res = await postWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(200);

    const [updated] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    expect(updated.status).toBe("failed");
    expect(await activeGrantCount(user.id, course.id)).toBe(0);

    const after = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(403);
  });

  it("rejects a CONFIRMED notification whose paymentId does not match (400)", async () => {
    const { user } = await createUser();
    const { course } = await seedCourse();
    const payment = await createPendingPayment(user.id, course.id);

    const body = {
      externalId: String(payment.id),
      paymentId: "PAYNOW-WRONG-ID",
      status: "CONFIRMED",
    };
    const res = await postWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(400);
    expect(await activeGrantCount(user.id, course.id)).toBe(0);
  });
});
