import { describe, it, expect } from "vitest";
import request from "supertest";
import { db } from "@workspace/db";
import { learningProgress } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import app from "../src/app";
import { createUser, seedCourse, grantAccess } from "./helpers/factories";

async function getRow(userId: number, topicId: number) {
  const [row] = await db
    .select()
    .from(learningProgress)
    .where(
      and(
        eq(learningProgress.userId, userId),
        eq(learningProgress.topicId, topicId),
      ),
    )
    .limit(1);
  return row;
}

describe("POST /progress (client-trusted data is rejected)", () => {
  it("returns 403 when the user has no access to the course", async () => {
    const { token } = await createUser();
    const { topic } = await seedCourse();
    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, currentElementType: "video" });
    expect(res.status).toBe(403);
  });

  it("derives courseId/sectionId server-side and ignores client-supplied ones", async () => {
    const { user, token } = await createUser();
    const { course, section, topic } = await seedCourse();
    await grantAccess(user.id, course.id);

    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({
        topicId: topic.id,
        currentElementType: "video",
        // Malicious extras that must be ignored:
        courseId: 999999,
        sectionId: 888888,
        status: "completed",
      });

    expect(res.status).toBe(200);
    expect(res.body.courseId).toBe(course.id);
    expect(res.body.sectionId).toBe(section.id);
    expect(res.body.status).toBe("in_progress");
  });

  it("never lets the client mark quiz/task completed via /progress", async () => {
    const { user, token } = await createUser();
    const { course, topic } = await seedCourse();
    await grantAccess(user.id, course.id);

    await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({
        topicId: topic.id,
        currentElementType: "task",
        quizCompleted: true,
        taskCheckedByAi: true,
      });

    const row = await getRow(user.id, topic.id);
    expect(row.quizCompleted).toBe(false);
    expect(row.taskCheckedByAi).toBe(false);
  });

  it("returns 404 for a non-existent topicId", async () => {
    const { token } = await createUser();
    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: 99999999, currentElementType: "video" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid body", async () => {
    const { token } = await createUser();
    const res = await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentElementType: "unknown" });
    expect(res.status).toBe(400);
  });

  it("does not reset videoCompleted once it is true", async () => {
    const { user, token } = await createUser();
    const { course, topic } = await seedCourse();
    await grantAccess(user.id, course.id);

    await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, currentElementType: "video", videoCompleted: true });

    await request(app)
      .post("/api/progress")
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, currentElementType: "quiz" });

    const row = await getRow(user.id, topic.id);
    expect(row.videoCompleted).toBe(true);
  });
});
