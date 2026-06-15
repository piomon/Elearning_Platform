import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, seedCourse } from "./helpers/factories";

describe("POST /payments/create", () => {
  it("rejects a missing or invalid courseId with 400", async () => {
    const { token } = await createUser();
    const res = await request(app)
      .post("/api/payments/create")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unpublished course", async () => {
    const { token } = await createUser();
    const { course } = await seedCourse({ published: false });
    const res = await request(app)
      .post("/api/payments/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: course.id });
    expect(res.status).toBe(404);
  });

  it("creates a pending payment for a published course (mock mode)", async () => {
    const { token } = await createUser();
    const { course } = await seedCourse();
    const res = await request(app)
      .post("/api/payments/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: course.id });
    expect(res.status).toBe(200);
    expect(res.body.paymentId).toBeTypeOf("number");
    expect(res.body.redirectUrl).toContain("/payment/success");
  });
});

describe("Mock payment flow grants course access", () => {
  it("activates access only after mock-complete", async () => {
    const { token } = await createUser();
    const { course, topic } = await seedCourse();

    // No access to the paid lesson content before paying.
    const before = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(before.status).toBe(403);

    const create = await request(app)
      .post("/api/payments/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: course.id });
    expect(create.status).toBe(200);

    const complete = await request(app)
      .post(`/api/payments/mock-complete/${create.body.paymentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(complete.status).toBe(200);

    const after = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(200);
  });

  it("does not let a user complete another user's payment", async () => {
    const buyer = await createUser();
    const attacker = await createUser();
    const { course } = await seedCourse();

    const create = await request(app)
      .post("/api/payments/create")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ courseId: course.id });

    const res = await request(app)
      .post(`/api/payments/mock-complete/${create.body.paymentId}`)
      .set("Authorization", `Bearer ${attacker.token}`);
    expect(res.status).toBe(404);
  });
});
