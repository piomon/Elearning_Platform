import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, createAdmin, seedCourse, grantAccess } from "./helpers/factories";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Discount codes — CRUD + guards", () => {
  it("blocks non-admins (403)", async () => {
    const { token } = await createUser();
    const res = await request(app).get("/api/admin/discounts").set(auth(token));
    expect(res.status).toBe(403);
  });

  it("creates a percent discount and lists it", async () => {
    const { token } = await createAdmin();
    const code = `LATO${Date.now()}`.slice(0, 18);
    const create = await request(app)
      .post("/api/admin/discounts")
      .set(auth(token))
      .send({ code, type: "percent", value: 20 });
    expect(create.status).toBe(201);
    expect(create.body.code).toBe(code.toUpperCase());

    const list = await request(app).get("/api/admin/discounts").set(auth(token));
    expect(list.status).toBe(200);
    expect(list.body.some((d: any) => d.code === code.toUpperCase())).toBe(true);
  });

  it("rejects a too-short code (400)", async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post("/api/admin/discounts")
      .set(auth(token))
      .send({ code: "AB", type: "percent", value: 10 });
    expect(res.status).toBe(400);
  });

  it("rejects a percent value over 100 (400)", async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post("/api/admin/discounts")
      .set(auth(token))
      .send({ code: `PCT${Date.now()}`, type: "percent", value: 150 });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate code (409)", async () => {
    const { token } = await createAdmin();
    const code = `DUP${Date.now()}`;
    await request(app).post("/api/admin/discounts").set(auth(token)).send({ code, type: "percent", value: 10 });
    const res = await request(app).post("/api/admin/discounts").set(auth(token)).send({ code, type: "percent", value: 10 });
    expect(res.status).toBe(409);
  });

  it("toggles and deletes an unused code", async () => {
    const { token } = await createAdmin();
    const code = `TGL${Date.now()}`;
    const create = await request(app).post("/api/admin/discounts").set(auth(token)).send({ code, type: "amount", value: 1000 });
    const id = create.body.id;

    const toggle = await request(app).patch(`/api/admin/discounts/${id}/toggle`).set(auth(token));
    expect(toggle.status).toBe(200);
    expect(toggle.body.isActive).toBe(false);

    const del = await request(app).delete(`/api/admin/discounts/${id}`).set(auth(token));
    expect(del.status).toBe(200);
  });
});

describe("Discount validation at purchase", () => {
  it("rejects an unknown code (404)", async () => {
    const { token, user } = await createUser();
    const { course } = await seedCourse({ published: true });
    const res = await request(app)
      .post("/api/payments/validate-discount")
      .set(auth(token))
      .send({ courseId: course.id, code: "NIEISTNIEJE" });
    expect([400, 404]).toContain(res.status);
    expect(user.id).toBeGreaterThan(0);
  });

  it("returns the computed discount for a valid percent code", async () => {
    const { token: adminToken } = await createAdmin();
    const { token: userToken } = await createUser();
    const { course } = await seedCourse({ published: true });
    const code = `OK${Date.now()}`;
    await request(app).post("/api/admin/discounts").set(auth(adminToken)).send({ code, type: "percent", value: 50 });

    const res = await request(app)
      .post("/api/payments/validate-discount")
      .set(auth(userToken))
      .send({ courseId: course.id, code });
    expect(res.status).toBe(200);
    expect(res.body.discountGrosz).toBeGreaterThan(0);
    expect(res.body.amountAfterGrosz).toBe(res.body.amountBeforeGrosz - res.body.discountGrosz);
  });

  it("records a discount use exactly once even when completion is retried (idempotent)", async () => {
    const { token: adminToken } = await createAdmin();
    const { token: userToken } = await createUser();
    const { course } = await seedCourse({ published: true });
    const code = `IDEM${Date.now()}`;
    const created = await request(app)
      .post("/api/admin/discounts")
      .set(auth(adminToken))
      .send({ code, type: "percent", value: 25 });
    const discountId = created.body.id;

    // Mock payment flow (no Paynow creds in test) returns a paymentId we can
    // complete directly via the dev/test mock-complete endpoint.
    const pay = await request(app)
      .post("/api/payments/create")
      .set(auth(userToken))
      .send({ courseId: course.id, discountCode: code });
    expect(pay.status).toBe(200);
    const paymentId = pay.body.paymentId;
    expect(paymentId).toBeGreaterThan(0);

    // Complete twice — simulates a provider/webhook retry.
    const first = await request(app).post(`/api/payments/mock-complete/${paymentId}`).set(auth(userToken));
    expect(first.status).toBe(200);
    const second = await request(app).post(`/api/payments/mock-complete/${paymentId}`).set(auth(userToken));
    expect(second.status).toBe(200);

    const uses = await request(app).get(`/api/admin/discounts/${discountId}/uses`).set(auth(adminToken));
    expect(uses.status).toBe(200);
    const rows = Array.isArray(uses.body) ? uses.body : uses.body.uses;
    expect(rows.filter((u: any) => u.paymentId === paymentId).length).toBe(1);

    const list = await request(app).get("/api/admin/discounts").set(auth(adminToken));
    const row = list.body.find((d: any) => d.id === discountId);
    expect(row.usedCount).toBe(1);
  });
});

describe("Access view (Dostępy)", () => {
  it("lists grants and supports grant + revoke with history", async () => {
    const { token: adminToken, user: admin } = await createAdmin();
    const { user: target } = await createUser();
    const { course } = await seedCourse({ published: true });

    const grant = await request(app)
      .post("/api/admin/access")
      .set(auth(adminToken))
      .send({ userId: target.id, courseId: course.id, note: "test grant" });
    expect(grant.status).toBe(201);
    const grantId = grant.body.id;

    const list = await request(app).get("/api/admin/access?status=active").set(auth(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.some((g: any) => g.id === grantId)).toBe(true);

    const dup = await request(app)
      .post("/api/admin/access")
      .set(auth(adminToken))
      .send({ userId: target.id, courseId: course.id });
    expect(dup.status).toBe(409);

    const revoke = await request(app)
      .delete(`/api/admin/access/${grantId}`)
      .set(auth(adminToken))
      .send({ note: "test revoke" });
    expect(revoke.status).toBe(200);
    expect(revoke.body.status).toBe("revoked");

    const history = await request(app).get("/api/admin/access/history").set(auth(adminToken));
    expect(history.status).toBe(200);
    expect(history.body.logs.some((l: any) => l.action === "grant_access")).toBe(true);
    expect(admin.id).toBeGreaterThan(0);
  });

  it("rejects revoking an already-inactive grant (400)", async () => {
    const { token } = await createAdmin();
    const { user: target } = await createUser();
    const { course } = await seedCourse({ published: true });
    const grant = await grantAccess(target.id, course.id, { status: "revoked" });
    const res = await request(app).delete(`/api/admin/access/${grant.id}`).set(auth(token));
    expect(res.status).toBe(400);
  });
});

describe("Platform settings", () => {
  it("returns a catalog and rejects unknown keys (no secret storage)", async () => {
    const { token } = await createAdmin();
    const get = await request(app).get("/api/admin/settings").set(auth(token));
    expect(get.status).toBe(200);
    expect(Array.isArray(get.body)).toBe(true);

    const bad = await request(app)
      .put("/api/admin/settings")
      .set(auth(token))
      .send({ settings: [{ key: "SMTP_PASSWORD", value: "secret" }] });
    expect(bad.status).toBe(400);
  });

  it("persists a valid known setting", async () => {
    const { token } = await createAdmin();
    const get = await request(app).get("/api/admin/settings").set(auth(token));
    const first = get.body[0];
    if (!first) return;
    const value =
      first.type === "boolean" ? !first.value : first.type === "number" ? Number(first.value ?? first.default ?? first.min ?? 1) : String(first.value ?? first.default ?? "x");
    const put = await request(app)
      .put("/api/admin/settings")
      .set(auth(token))
      .send({ settings: [{ key: first.key, value }] });
    expect(put.status).toBe(200);
  });
});

describe("Export endpoints", () => {
  it("exports lessons as CSV with a BOM", async () => {
    const { token } = await createAdmin();
    await seedCourse({ published: true });
    const res = await request(app).get("/api/admin/export/lessons?format=csv").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
  });

  it("exports users and payments as CSV", async () => {
    const { token } = await createAdmin();
    const users = await request(app).get("/api/admin/export/users").set(auth(token));
    expect(users.status).toBe(200);
    expect(users.headers["content-type"]).toContain("text/csv");
    const payments = await request(app).get("/api/admin/export/payments").set(auth(token));
    expect(payments.status).toBe(200);
    expect(payments.headers["content-type"]).toContain("text/csv");
  });
});

describe("Pre-publish preview", () => {
  it("previews an unpublished course as a student", async () => {
    const { token } = await createAdmin();
    const { course } = await seedCourse({ published: false });
    const res = await request(app).get(`/api/admin/courses/${course.id}/preview`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(res.body.hasAccess).toBe(true);
  });

  it("previews the landing page including hidden sections", async () => {
    const { token } = await createAdmin();
    const res = await request(app).get("/api/admin/preview/landing").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
  });

  it("previews a quiz without exposing correct answers", async () => {
    const { token } = await createAdmin();
    const { quiz } = await seedCourse({ published: false });
    const res = await request(app).get(`/api/admin/quizzes/${quiz.id}/preview`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    const leaks = JSON.stringify(res.body).includes("isCorrect");
    expect(leaks).toBe(false);
  });
});
