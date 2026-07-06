import { describe, it, expect } from "vitest";
import request from "supertest";
import { db } from "@workspace/db";
import { videos, quizAnswers, topics } from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../src/app";
import { createUser, createAdmin, seedCourse, grantAccess } from "./helpers/factories";
import { signQuizStart } from "../src/lib/quiz-timer";

describe("Lesson (topic) admin extensions", () => {
  it("duplicates a topic with its content", async () => {
    const { token } = await createAdmin();
    const { topic } = await seedCourse();
    const res = await request(app)
      .post(`/api/admin/topics/${topic.id}/duplicate`)
      .set("Authorization", `Bearer ${token}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).not.toBe(topic.id);
  });

  it("reorders topics within a section", async () => {
    const { token } = await createAdmin();
    const { section, topic } = await seedCourse();
    const res = await request(app)
      .post(`/api/admin/topics/reorder`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sectionId: section.id, ids: [topic.id] });
    expect(res.status).toBe(200);
  });

  it("returns a student-facing preview of a topic", async () => {
    const { token } = await createAdmin();
    const { topic } = await seedCourse();
    const res = await request(app)
      .get(`/api/admin/topics/${topic.id}/preview`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBeTruthy();
    // Preview must not leak quiz correct answers.
    expect(JSON.stringify(res.body)).not.toContain("isCorrect");
  });

  it("persists new lesson metadata fields", async () => {
    const { token } = await createAdmin();
    const { section, topic } = await seedCourse();
    const res = await request(app)
      .put(`/api/admin/topics/${topic.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        sectionId: section.id,
        title: topic.title,
        slug: topic.slug,
        sortOrder: 1,
        objectives: "Cel testowy",
        durationMinutes: 42,
        difficulty: "hard",
        accessType: "free",
        metaTitle: "Meta tytuł",
      });
    expect(res.status).toBe(200);
    expect(res.body.objectives).toBe("Cel testowy");
    expect(res.body.durationMinutes).toBe(42);
    expect(res.body.accessType).toBe("free");
  });

  it("blocks non-admins from a new lesson endpoint (403)", async () => {
    const { token } = await createUser();
    const { topic } = await seedCourse();
    const res = await request(app)
      .post(`/api/admin/topics/${topic.id}/duplicate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("Quiz admin extensions", () => {
  it("persists quiz settings fields", async () => {
    const { token } = await createAdmin();
    const { topic, quiz } = await seedCourse();
    const res = await request(app)
      .put(`/api/admin/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        topicId: topic.id,
        title: "Quiz zaktualizowany",
        passThreshold: 70,
        maxAttempts: 3,
        timeLimitMinutes: 15,
        shuffleQuestions: true,
        shuffleAnswers: true,
        showScore: false,
        showCorrectAnswers: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.passThreshold).toBe(70);
    expect(res.body.maxAttempts).toBe(3);
    expect(res.body.shuffleQuestions).toBe(true);
  });

  it("duplicates a quiz with its questions", async () => {
    const { token } = await createAdmin();
    const { quiz } = await seedCourse();
    const res = await request(app)
      .post(`/api/admin/quizzes/${quiz.id}/duplicate`)
      .set("Authorization", `Bearer ${token}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).not.toBe(quiz.id);
  });

  it("reorders quiz questions", async () => {
    const { token } = await createAdmin();
    const { quiz, questions } = await seedCourse();
    const ids = questions.map((q) => q.id).reverse();
    const res = await request(app)
      .post(`/api/admin/quizzes/${quiz.id}/questions/reorder`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ids });
    expect(res.status).toBe(200);
  });

  it("duplicates a quiz question", async () => {
    const { token } = await createAdmin();
    const { questions } = await seedCourse();
    const res = await request(app)
      .post(`/api/admin/questions/${questions[0].id}/duplicate`)
      .set("Authorization", `Bearer ${token}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).not.toBe(questions[0].id);
  });
});

describe("Lesson images (materials) module", () => {
  it("creates, lists, updates, reorders and deletes images", async () => {
    const { token } = await createAdmin();
    const { topic } = await seedCourse();

    const created = await request(app)
      .post(`/api/admin/images`)
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, imageUrl: "https://example.com/a.png", alt: "A", sortOrder: 0 });
    expect([200, 201]).toContain(created.status);
    const imageId = created.body.id;

    const list = await request(app)
      .get(`/api/admin/topics/${topic.id}/images`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    const updated = await request(app)
      .put(`/api/admin/images/${imageId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ alt: "Zmieniony" });
    expect(updated.status).toBe(200);
    expect(updated.body.alt).toBe("Zmieniony");

    const reorder = await request(app)
      .post(`/api/admin/images/reorder`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [imageId] });
    expect(reorder.status).toBe(200);

    const del = await request(app)
      .delete(`/api/admin/images/${imageId}`)
      .set("Authorization", `Bearer ${token}`);
    expect([200, 204]).toContain(del.status);
  });
});

describe("Bunny video assignment", () => {
  it("assigns a video by GUID to a topic", async () => {
    const { token } = await createAdmin();
    const { topic } = await seedCourse();
    const guid = "11111111-2222-3333-4444-555555555555";
    const res = await request(app)
      .post(`/api/admin/bunny/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, source: guid, title: "Przypisane wideo" });
    expect(res.status).toBe(200);
    expect(res.body.bunnyVideoId).toBe(guid);

    const [row] = await db.select().from(videos).where(eq(videos.topicId, topic.id)).limit(1);
    expect(row.bunnyVideoId).toBe(guid);
  });

  it("rejects an unrecognized video source (400)", async () => {
    const { token } = await createAdmin();
    const { topic } = await seedCourse();
    const res = await request(app)
      .post(`/api/admin/bunny/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, source: "not-a-guid" });
    expect(res.status).toBe(400);
  });

  it("returns 409 when the GUID is already assigned to another lesson", async () => {
    const { token } = await createAdmin();
    const { section, topic } = await seedCourse();
    const guid = "99999999-8888-7777-6666-555555555555";

    const first = await request(app)
      .post(`/api/admin/bunny/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, source: guid });
    expect(first.status).toBe(200);

    const [otherTopic] = await db
      .insert(topics)
      .values({ sectionId: section.id, title: "Druga lekcja", slug: "druga-lekcja", sortOrder: 1 })
      .returning();

    const conflict = await request(app)
      .post(`/api/admin/bunny/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: otherTopic.id, source: guid });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toContain(topic.title);
  });
});

describe("AI settings", () => {
  it("never exposes the API key and round-trips settings", async () => {
    const { token } = await createAdmin();

    const get = await request(app)
      .get(`/api/admin/ai-settings`)
      .set("Authorization", `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body).not.toHaveProperty("apiKey");
    expect(get.body).not.toHaveProperty("key");
    expect(get.body).toHaveProperty("keyConfigured");

    const put = await request(app)
      .put(`/api/admin/ai-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        enabled: false,
        model: "gemini-test",
        systemPrompt: "Jesteś nauczycielem.",
        evalInstruction: "Oceń rozwiązanie.",
        tone: "przyjazny",
        maxResponseLength: 300,
        errorMessage: "AI wyłączone",
      });
    expect(put.status).toBe(200);
    expect(put.body.enabled).toBe(false);
    expect(put.body.model).toBe("gemini-test");
    expect(put.body).not.toHaveProperty("apiKey");
  });

  it("blocks non-admins from AI settings (403)", async () => {
    const { token } = await createUser();
    const res = await request(app)
      .get(`/api/admin/ai-settings`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("Quiz publish validation", () => {
  it("blocks publishing an empty quiz (no questions)", async () => {
    const { token } = await createAdmin();
    const { topic } = await seedCourse();
    // A fresh quiz with no questions.
    const created = await request(app)
      .post(`/api/admin/quizzes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, title: "Pusty quiz" });
    expect([200, 201]).toContain(created.status);
    const quizId = created.body.id;

    const res = await request(app)
      .patch(`/api/admin/quizzes/${quizId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "published" });
    expect(res.status).toBe(400);
  });

  it("blocks publishing when a question has fewer than two answers", async () => {
    const { token } = await createAdmin();
    const { quiz, questions } = await seedCourse();
    // Strip a question down to a single answer.
    const q = questions[0];
    for (const a of q.answers.slice(1)) {
      await request(app)
        .delete(`/api/admin/answers/${a.id}`)
        .set("Authorization", `Bearer ${token}`);
    }
    const res = await request(app)
      .patch(`/api/admin/quizzes/${quiz.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "published" });
    expect(res.status).toBe(400);
  });

  it("allows publishing a complete quiz", async () => {
    const { token } = await createAdmin();
    const { quiz } = await seedCourse();
    const res = await request(app)
      .patch(`/api/admin/quizzes/${quiz.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "published" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("published");
  });

  it("blocks publishing via PUT for an invalid quiz", async () => {
    const { token } = await createAdmin();
    const { topic } = await seedCourse();
    const created = await request(app)
      .post(`/api/admin/quizzes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ topicId: topic.id, title: "Pusty quiz 2" });
    const quizId = created.body.id;
    const res = await request(app)
      .put(`/api/admin/quizzes/${quizId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Pusty quiz 2", status: "published" });
    expect(res.status).toBe(400);
  });
});

describe("Quiz runtime settings enforcement", () => {
  it("enforces maxAttempts on the student attempts endpoint", async () => {
    const { user, token } = await createUser();
    const { course, quiz, questions } = await seedCourse();
    await grantAccess(user.id, course.id);

    // Limit to a single attempt.
    const admin = await createAdmin();
    await request(app)
      .put(`/api/admin/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Quiz testowy", status: "published", maxAttempts: 1 });

    const submission = {
      answers: questions.map((q) => ({
        questionId: q.id,
        selectedAnswerId: q.correctAnswerId,
      })),
    };

    const first = await request(app)
      .post(`/api/quizzes/${quiz.id}/attempts`)
      .set("Authorization", `Bearer ${token}`)
      .send(submission);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/quizzes/${quiz.id}/attempts`)
      .set("Authorization", `Bearer ${token}`)
      .send(submission);
    expect(second.status).toBe(403);
  });

  it("hides score and correct answers when configured", async () => {
    const { user, token } = await createUser();
    const { course, quiz, questions } = await seedCourse();
    await grantAccess(user.id, course.id);

    const admin = await createAdmin();
    await request(app)
      .put(`/api/admin/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        title: "Quiz testowy",
        status: "published",
        showScore: false,
        showCorrectAnswers: false,
      });

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
    expect(res.body).not.toHaveProperty("score");
    expect(res.body).not.toHaveProperty("percentage");
    expect(res.body).toHaveProperty("passed");
    for (const a of res.body.answers) {
      expect(a).not.toHaveProperty("correctAnswerId");
    }
  });

  it("exposes attempt counts on the quiz GET", async () => {
    const { user, token } = await createUser();
    const { course, quiz } = await seedCourse();
    await grantAccess(user.id, course.id);

    const admin = await createAdmin();
    await request(app)
      .put(`/api/admin/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Quiz testowy", status: "published", maxAttempts: 3 });

    const res = await request(app)
      .get(`/api/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.attemptsUsed).toBe(0);
    expect(res.body.attemptsRemaining).toBe(3);
  });
});

describe("Quiz answer reordering", () => {
  it("persists a new answer order via the reorder endpoint", async () => {
    const { user, token } = await createUser();
    const { course, quiz, questions } = await seedCourse();
    await grantAccess(user.id, course.id);

    const admin = await createAdmin();
    await request(app)
      .put(`/api/admin/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Quiz testowy", status: "published" });

    const q = questions[0];
    const reversed = [...q.answers.map((a) => a.id)].reverse();

    const reorderRes = await request(app)
      .post(`/api/admin/questions/${q.id}/answers/reorder`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ ids: reversed });
    expect(reorderRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    const qDto = getRes.body.questions.find((x: any) => x.id === q.id);
    expect(qDto.answers.map((a: any) => a.id)).toEqual(reversed);
  });

  it("does not reorder answers belonging to another question", async () => {
    const { token: adminToken } = await createAdmin();
    const { questions } = await seedCourse();
    const [q1, q2] = questions;

    // Attempt to reorder q2's answers through q1's endpoint — the parent scope
    // must prevent any cross-question writes.
    const res = await request(app)
      .post(`/api/admin/questions/${q1.id}/answers/reorder`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ids: [...q2.answers.map((a) => a.id)].reverse() });
    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(quizAnswers)
      .where(eq(quizAnswers.questionId, q2.id));
    // All of q2's answers keep their default ordering (untouched).
    for (const r of rows) {
      expect(r.sortOrder).toBe(0);
    }
  });
});

describe("Quiz time-limit enforcement", () => {
  it("issues a start token from the attempts/start endpoint", async () => {
    const { user, token } = await createUser();
    const { course, quiz } = await seedCourse();
    await grantAccess(user.id, course.id);

    const admin = await createAdmin();
    await request(app)
      .put(`/api/admin/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Quiz testowy", status: "published", timeLimitMinutes: 10 });

    const res = await request(app)
      .post(`/api/quizzes/${quiz.id}/attempts/start`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(typeof res.body.startToken).toBe("string");
    expect(res.body.timeLimitMinutes).toBe(10);
    expect(typeof res.body.startedAt).toBe("number");
  });

  it("rejects a timed submission without a start token", async () => {
    const { user, token } = await createUser();
    const { course, quiz, questions } = await seedCourse();
    await grantAccess(user.id, course.id);

    const admin = await createAdmin();
    await request(app)
      .put(`/api/admin/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Quiz testowy", status: "published", timeLimitMinutes: 10 });

    const res = await request(app)
      .post(`/api/quizzes/${quiz.id}/attempts`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedAnswerId: q.correctAnswerId,
        })),
      });
    expect(res.status).toBe(400);
  });

  it("accepts a timed submission with a valid start token", async () => {
    const { user, token } = await createUser();
    const { course, quiz, questions } = await seedCourse();
    await grantAccess(user.id, course.id);

    const admin = await createAdmin();
    await request(app)
      .put(`/api/admin/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Quiz testowy", status: "published", timeLimitMinutes: 10 });

    const startToken = signQuizStart(quiz.id, user.id);
    const res = await request(app)
      .post(`/api/quizzes/${quiz.id}/attempts`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        startToken,
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedAnswerId: q.correctAnswerId,
        })),
      });
    expect(res.status).toBe(201);
  });

  it("rejects a submission after the time limit has elapsed", async () => {
    const { user, token } = await createUser();
    const { course, quiz, questions } = await seedCourse();
    await grantAccess(user.id, course.id);

    const admin = await createAdmin();
    await request(app)
      .put(`/api/admin/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Quiz testowy", status: "published", timeLimitMinutes: 5 });

    // Back-date the start by 10 minutes — well past the 5-minute window.
    const expiredToken = signQuizStart(quiz.id, user.id, Date.now() - 10 * 60_000);
    const res = await request(app)
      .post(`/api/quizzes/${quiz.id}/attempts`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        startToken: expiredToken,
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedAnswerId: q.correctAnswerId,
        })),
      });
    expect(res.status).toBe(403);
  });

  it("ignores the start token for untimed quizzes", async () => {
    const { user, token } = await createUser();
    const { course, quiz, questions } = await seedCourse();
    await grantAccess(user.id, course.id);

    const admin = await createAdmin();
    await request(app)
      .put(`/api/admin/quizzes/${quiz.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ title: "Quiz testowy", status: "published", timeLimitMinutes: null });

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
  });
});
