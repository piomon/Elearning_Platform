import { Router } from "express";
import { db } from "@workspace/db";
import { quizzes, quizQuestions, quizAnswers, quizAttempts, quizAttemptAnswers, learningProgress } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/quizzes/:quizId", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const quizId = Number(req.params.quizId);
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
    if (!quiz) {
      res.status(404).json({ error: "Quiz nie znaleziony" });
      return;
    }

    const questionList = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId)).orderBy(asc(quizQuestions.sortOrder));
    const questionsWithAnswers = await Promise.all(
      questionList.map(async (q) => {
        const answers = await db.select({
          id: quizAnswers.id,
          questionId: quizAnswers.questionId,
          answerLabel: quizAnswers.answerLabel,
          answerText: quizAnswers.answerText,
          isCorrect: quizAnswers.isCorrect,
        }).from(quizAnswers).where(eq(quizAnswers.questionId, q.id));
        return { ...q, answers };
      })
    );

    res.json({ ...quiz, questions: questionsWithAnswers });
  } catch (err) {
    req.log.error({ err }, "Get quiz error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/quizzes/:quizId/attempts", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const quizId = Number(req.params.quizId);
    const { answers } = req.body as { answers: Array<{ questionId: number; selectedAnswerId: number }> };

    if (!answers || !Array.isArray(answers)) {
      res.status(400).json({ error: "Nieprawidłowe dane" });
      return;
    }

    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
    if (!quiz) {
      res.status(404).json({ error: "Quiz nie znaleziony" });
      return;
    }

    const correctAnswers = await db
      .select({ id: quizAnswers.id, questionId: quizAnswers.questionId, isCorrect: quizAnswers.isCorrect })
      .from(quizAnswers)
      .where(eq(quizAnswers.isCorrect, true));

    const correctMap = Object.fromEntries(correctAnswers.map((a) => [a.questionId, a.id]));

    let score = 0;
    const answerResults = answers.map((a) => {
      const isCorrect = correctMap[a.questionId] === a.selectedAnswerId;
      if (isCorrect) score++;
      return {
        questionId: a.questionId,
        selectedAnswerId: a.selectedAnswerId,
        isCorrect,
        correctAnswerId: correctMap[a.questionId] ?? a.selectedAnswerId,
      };
    });

    const [attempt] = await db.insert(quizAttempts).values({
      userId: req.user!.id,
      quizId,
      score,
      totalQuestions: answers.length,
      completedAt: new Date(),
    }).returning();

    await db.insert(quizAttemptAnswers).values(
      answers.map((a) => ({
        attemptId: attempt.id,
        questionId: a.questionId,
        selectedAnswerId: a.selectedAnswerId,
        isCorrect: correctMap[a.questionId] === a.selectedAnswerId,
      }))
    );

    await db.update(learningProgress).set({ quizCompleted: true, updatedAt: new Date() }).where(
      and(eq(learningProgress.userId, req.user!.id))
    );

    res.status(201).json({
      score,
      totalQuestions: answers.length,
      percentage: Math.round((score / answers.length) * 100),
      answers: answerResults,
    });
  } catch (err) {
    req.log.error({ err }, "Submit quiz attempt error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export default router;
