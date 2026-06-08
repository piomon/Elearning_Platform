import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, createAdmin, seedCourse, grantAccess } from "./helpers/factories";

describe("GET /sections/:sectionId/topics access control", () => {
  it("returns 401 for an unauthenticated request", async () => {
    const { section } = await seedCourse();
    const res = await request(app).get(`/api/sections/${section.id}/topics`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a logged-in user without an access grant", async () => {
    const { token } = await createUser();
    const { section } = await seedCourse();
    const res = await request(app)
      .get(`/api/sections/${section.id}/topics`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns the topic list for a user with an active grant", async () => {
    const { user, token } = await createUser();
    const { course, section } = await seedCourse();
    await grantAccess(user.id, course.id);
    const res = await request(app)
      .get(`/api/sections/${section.id}/topics`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("returns the topic list for an admin without a grant", async () => {
    const { token } = await createAdmin();
    const { section } = await seedCourse();
    const res = await request(app)
      .get(`/api/sections/${section.id}/topics`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns 400 for an invalid sectionId", async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get(`/api/sections/abc/topics`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent section", async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get(`/api/sections/99999999/topics`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
