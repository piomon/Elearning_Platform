import { Router } from "express";
import { db } from "@workspace/db";
import {
  quizzes,
  quizQuestions,
  quizAnswers,
  quizAttempts,
  quizAttemptAnswers,
  learningProgress,
} from "@workspace/db";
import { eq, and, asc, inArray, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { requireCourseAccess, getCourseIdByQuizId, getTopicLocation } from "../lib/access";

const router = Router();

const quizAccess = requireCourseAccess((req) =>
  getCourseIdByQuizId(Number(req.params.quizId)),
);

router.get(
  "/quizzes/:quizId",
  requireAuth as any,
  quizAccess as any,
  async (req: AuthRequest, res) => {
    try {
      const quizId = Number(req.params.quizId);
      const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
      if (!quiz) {
        res.status(404).json({ error: "Quiz nie znaleziony" });
        return;
      }

      const questionList = await db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quizId))
        .orderBy(asc(quizQuestions.sortOrder));

      const questionsWithAnswers = await Promise.all(
        questionList.map(async (q) => {
          // Student-facing DTO must not leak which answer is correct.
          const answers = await db
            .select({
              id: quizAnswers.id,
              questionId: quizAnswers.questionId,
              answerLabel: quizAnswers.answerLabel,
              answerText: quizAnswers.answerText,
            })
            .from(quizAnswers)
            .where(eq(quizAnswers.questionId, q.id))
            .orderBy(asc(quizAnswers.answerLabel));
          return { ...q, answers };
        }),
      );

      res.json({ ...quiz, questions: questionsWithAnswers });
    } catch (err) {
      req.log.error({ err }, "Get quiz error");
      res.status(500).json({ error: "Błąd serwera" });
    }
  },
);

router.post(
  "/quizzes/:quizId/attempts",
  requireAuth as any,
  quizAccess as any,
  async (req: AuthRequest, res) => {
    try {
      const quizId = Number(req.params.quizId);
      const { answers } = req.body as {
        answers?: Array<{ questionId: number; selectedAnswerId: number }>;
      };

      if (!answers || !Array.isArray(answers) || answers.length === 0) {
        res.status(400).json({ error: "Nieprawidłowe dane" });
        return;
      }

      const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
      if (!quiz) {
        res.status(404).json({ error: "Quiz nie znaleziony" });
        return;
      }

      // All questions that belong to this quiz.
      const questionRows = await db
        .select({ id: quizQuestions.id })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quizId));
      const quizQuestionIds = new Set(questionRows.map((q) => q.id));

      if (quizQuestionIds.size === 0) {
        res.status(400).json({ error: "Quiz nie ma pytań" });
        return;
      }

      // All answers that belong to this quiz's questions (scoped, not global).
      const answerRows = await db
        .select({
          id: quizAnswers.id,
          questionId: quizAnswers.questionId,
          isCorrect: quizAnswers.isCorrect,
        })
        .from(quizAnswers)
        .where(inArray(quizAnswers.questionId, [...quizQuestionIds]));

      const answerById = new Map(answerRows.map((a) => [a.id, a]));
      const correctByQuestion = new Map<number, number>();
      for (const a of answerRows) {
        if (a.isCorrect) correctByQuestion.set(a.questionId, a.id);
      }

      // Validate that every submitted answer references a question and answer
      // that genuinely belong to this quiz, and that there are no duplicates.
      const seenQuestions = new Set<number>();
      for (const a of answers) {
        const questionId = Number(a?.questionId);
        const selectedAnswerId = Number(a?.selectedAnswerId);
        if (!Number.isInteger(questionId) || !Number.isInteger(selectedAnswerId)) {
          res.status(400).json({ error: "Nieprawidłowe dane odpowiedzi" });
          return;
        }
        if (!quizQuestionIds.has(questionId)) {
          res.status(400).json({ error: "Pytanie nie należy do tego quizu" });
          return;
        }
        const selected = answerById.get(selectedAnswerId);
        if (!selected || selected.questionId !== questionId) {
          res.status(400).json({ error: "Odpowiedź nie należy do tego pytania" });
          return;
        }
        if (seenQuestions.has(questionId)) {
          res.status(400).json({ error: "Zduplikowana odpowiedź na pytanie" });
          return;
        }
        seenQuestions.add(questionId);
      }

      // A submission must answer every question in the quiz — partial attempts
      // are rejected so quizCompleted reflects a genuinely finished quiz.
      if (seenQuestions.size !== quizQuestionIds.size) {
        res.status(400).json({ error: "Należy odpowiedzieć na wszystkie pytania" });
        return;
      }

      // Score against every question in the quiz (server-side authority).
      const totalQuestions = quizQuestionIds.size;
      const submittedByQuestion = new Map(
        answers.map((a) => [Number(a.questionId), Number(a.selectedAnswerId)]),
      );

      let score = 0;
      const answerResults = [...quizQuestionIds].map((questionId) => {
        const selectedAnswerId = submittedByQuestion.get(questionId) ?? null;
        const correctAnswerId = correctByQuestion.get(questionId) ?? null;
        const isCorrect =
          selectedAnswerId !== null && selectedAnswerId === correctAnswerId;
        if (isCorrect) score++;
        return { questionId, selectedAnswerId, isCorrect, correctAnswerId };
      });

      const percentage =
        totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
      const PASS_THRESHOLD = 80;
      const passed = percentage >= PASS_THRESHOLD;

      const location = await getTopicLocation(quiz.topicId);
      if (!location) {
        res.status(404).json({ error: "Temat nie znaleziony" });
        return;
      }

      await db.transaction(async (tx) => {
        const [attempt] = await tx
          .insert(quizAttempts)
          .values({
            userId: req.user!.id,
            quizId,
            score,
            totalQuestions,
            completedAt: new Date(),
          })
          .returning();

        const persistable = answerResults.filter((r) => r.selectedAnswerId !== null);
        if (persistable.length > 0) {
          await tx.insert(quizAttemptAnswers).values(
            persistable.map((r) => ({
              attemptId: attempt.id,
              questionId: r.questionId,
              selectedAnswerId: r.selectedAnswerId as number,
              isCorrect: r.isCorrect,
            })),
          );
        }

        // Only a genuine pass (>= 80%) flips quizCompleted. Completion is
        // monotonic: a later failed attempt must never reset an earlier pass.
        // Upsert because a progress row may not exist yet (e.g. the student
        // jumped straight to the quiz).
        await tx
          .insert(learningProgress)
          .values({
            userId: req.user!.id,
            courseId: location.courseId,
            sectionId: location.sectionId,
            topicId: quiz.topicId,
            quizCompleted: passed,
          })
          .onConflictDoUpdate({
            target: [learningProgress.userId, learningProgress.topicId],
            set: {
              quizCompleted: sql`${learningProgress.quizCompleted} OR ${passed}`,
              updatedAt: new Date(),
            },
          });
      });

      res.status(201).json({
        score,
        totalQuestions,
        percentage,
        passed,
        passThreshold: PASS_THRESHOLD,
        answers: answerResults,
      });
    } catch (err) {
      req.log.error({ err }, "Submit quiz attempt error");
      res.status(500).json({ error: "Błąd serwera" });
    }
  },
);

export default router;
