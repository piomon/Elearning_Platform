import { describe, it, expect } from "vitest";
import request from "supertest";
import { db } from "@workspace/db";
import { learningProgress } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import app from "../src/app";
import { createUser, seedCourse, grantAccess } from "./helpers/factories";

describe("POST /quizzes/:quizId/attempts", () => {
  it("rejects an incomplete submission (not every question answered)", async () => {
    const { user, token } = await createUser();
    const { course, quiz, questions } = await seedCourse();
    await grantAccess(user.id, course.id);

    const res = await request(app)
      .post(`/api/quizzes/${quiz.id}/attempts`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        answers: [
          { questionId: questions[0].id, selectedAnswerId: questions[0].correctAnswerId },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("scores a complete submission and upserts progress (quizCompleted)", async () => {
    const { user, token } = await createUser();
    const { course, topic, quiz, questions } = await seedCourse();
    await grantAccess(user.id, course.id);

    const res = await request(app)
      .post(`/api/quizzes/${quiz.id}/attempts`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedAnswerId: q.correctAnswerId,
        })),
      });

    expect(res.status).toBe(201);
    expect(res.body.score).toBe(2);
    expect(res.body.totalQuestions).toBe(2);
    expect(res.body.percentage).toBe(100);

    const [row] = await db
      .select()
      .from(learningProgress)
      .where(
        and(
          eq(learningProgress.userId, user.id),
          eq(learningProgress.topicId, topic.id),
        ),
      )
      .limit(1);
    expect(row).toBeTruthy();
    expect(row.quizCompleted).toBe(true);
  });

  it("does not leak which answer is correct in the student-facing quiz DTO", async () => {
    const { user, token } = await createUser();
    const { course, quiz } = await seedCourse();
    await grantAccess(user.id, course.id);

    const res = await request(app)
      .get(`/api/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("isCorrect");
  });
});
