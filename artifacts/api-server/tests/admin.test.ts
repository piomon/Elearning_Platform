import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, createAdmin, seedCourse } from "./helpers/factories";

describe("Admin route guards", () => {
  it("blocks non-admins from admin routes (403)", async () => {
    const { token } = await createUser();
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("blocks unauthenticated access to admin routes (401)", async () => {
    const res = await request(app).get("/api/admin/dashboard");
    expect(res.status).toBe(401);
  });
});

describe("POST /admin/users/:id/access", () => {
  it("rejects a missing/invalid courseId with 400", async () => {
    const { token } = await createAdmin();
    const target = await createUser();
    const res = await request(app)
      .post(`/api/admin/users/${target.user.id}/access`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent course", async () => {
    const { token } = await createAdmin();
    const target = await createUser();
    const res = await request(app)
      .post(`/api/admin/users/${target.user.id}/access`)
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: 99999999 });
    expect(res.status).toBe(404);
  });

  it("grants access for a valid course", async () => {
    const { token } = await createAdmin();
    const target = await createUser();
    const { course } = await seedCourse();
    const res = await request(app)
      .post(`/api/admin/users/${target.user.id}/access`)
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: course.id });
    expect(res.status).toBe(201);
  });
});

describe("Quiz answer A–D enforcement", () => {
  it("rejects an answer label outside A–D", async () => {
    const { token } = await createAdmin();
    const { questions } = await seedCourse();
    const res = await request(app)
      .post(`/api/admin/questions/${questions[0].id}/answers`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answerLabel: "E", answerText: "Zła etykieta", isCorrect: false });
    expect(res.status).toBe(400);
  });

  it("rejects a 5th answer (max 4 A–D)", async () => {
    const { token } = await createAdmin();
    const { questions } = await seedCourse();
    // seedCourse already creates A–D, so any further valid label is a duplicate
    // and the count cap (4) is reached.
    const res = await request(app)
      .post(`/api/admin/questions/${questions[0].id}/answers`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answerLabel: "A", answerText: "Piąta", isCorrect: false });
    expect(res.status).toBe(400);
  });
});
