import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, createAdmin, seedCourse, grantAccess } from "./helpers/factories";

// The section -> topics listing is a metadata-only curriculum outline (titles,
// preview flag, which element types exist). It is readable by any authenticated
// user so the portal can render locked lessons with badges. It deliberately
// never returns the gated content itself — that is served by GET /topics/:topicId,
// which is the real access gate (see the suite below).
describe("GET /sections/:sectionId/topics (curriculum outline)", () => {
  it("returns 401 for an unauthenticated request", async () => {
    const { section } = await seedCourse();
    const res = await request(app).get(`/api/sections/${section.id}/topics`);
    expect(res.status).toBe(401);
  });

  it("returns the outline to an authenticated user without a grant, but leaks no gated content", async () => {
    const { token } = await createUser();
    const { section } = await seedCourse();
    const res = await request(app)
      .get(`/api/sections/${section.id}/topics`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // Only metadata + presence flags — never the actual video/quiz/task payload.
    const [first] = res.body;
    expect(first).toHaveProperty("hasVideo");
    expect(first).not.toHaveProperty("videos");
    expect(first).not.toHaveProperty("tasks");
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

  it("returns an empty outline for a non-existent section", async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get(`/api/sections/99999999/topics`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// The real paid-content gate. A lesson's full content (video, quiz, tasks) is
// only served to admins, users with an active grant, or for free-preview
// lessons. Everyone else gets 403 — this is the endpoint that protects paid
// material, enforced entirely server-side.
describe("GET /topics/:topicId (paid content access control)", () => {
  it("returns 401 for an unauthenticated request", async () => {
    const { topic } = await seedCourse();
    const res = await request(app).get(`/api/topics/${topic.id}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a logged-in user without an access grant", async () => {
    const { token } = await createUser();
    const { topic } = await seedCourse();
    const res = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent topic", async () => {
    const { token } = await createUser();
    const res = await request(app)
      .get(`/api/topics/99999999`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("serves the lesson to a user with an active grant", async () => {
    const { user, token } = await createUser();
    const { course, topic } = await seedCourse();
    await grantAccess(user.id, course.id);
    const res = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(topic.id);
  });

  it("serves the lesson to an admin without a grant", async () => {
    const { token } = await createAdmin();
    const { topic } = await seedCourse();
    const res = await request(app)
      .get(`/api/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
