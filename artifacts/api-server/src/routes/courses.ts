import { Router } from "express";
import { db } from "@workspace/db";
import { courses, sections, topics, videos, quizzes, quizQuestions, quizAnswers, tasks } from "@workspace/db";
import { eq, asc, and, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { requireCourseAccess, getCourseIdByTopicId } from "../lib/access";

const router = Router();

router.get("/courses", async (req, res) => {
  try {
    const all = await db.select().from(courses).where(eq(courses.isPublished, true));
    res.json(all);
  } catch (err) {
    req.log.error({ err }, "List courses error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/courses/:slug", async (req, res) => {
  try {
    const [course] = await db.select().from(courses).where(eq(courses.slug, req.params.slug)).limit(1);
    if (!course) {
      res.status(404).json({ error: "Kurs nie znaleziony" });
      return;
    }
    const sectionList = await db.select().from(sections).where(eq(sections.courseId, course.id)).orderBy(asc(sections.sortOrder));
    const topicCounts = await Promise.all(
      sectionList.map(async (s) => {
        const ts = await db.select({ id: topics.id }).from(topics).where(eq(topics.sectionId, s.id));
        return { sectionId: s.id, count: ts.length };
      })
    );
    const countMap = Object.fromEntries(topicCounts.map((t) => [t.sectionId, t.count]));
    const sectionsWithCount = sectionList.map((s) => ({ ...s, topicCount: countMap[s.id] ?? 0 }));
    res.json({ ...course, sections: sectionsWithCount });
  } catch (err) {
    req.log.error({ err }, "Get course error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/sections/:sectionId/topics", async (req, res) => {
  try {
    const sectionId = Number(req.params.sectionId);
    const topicList = await db.select().from(topics).where(eq(topics.sectionId, sectionId)).orderBy(asc(topics.sortOrder));

    const enriched = await Promise.all(
      topicList.map(async (t) => {
        const [vid] = await db.select({ id: videos.id }).from(videos).where(eq(videos.topicId, t.id)).limit(1);
        const [quiz] = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.topicId, t.id)).limit(1);
        const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.topicId, t.id)).limit(1);
        return {
          ...t,
          hasVideo: !!vid,
          hasQuiz: !!quiz,
          hasTasks: !!task,
        };
      })
    );
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "List topics error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get(
  "/topics/:topicId",
  requireAuth as any,
  requireCourseAccess((req) => getCourseIdByTopicId(Number(req.params.topicId))) as any,
  async (req: AuthRequest, res) => {
  try {
    const topicId = Number(req.params.topicId);
    const [topic] = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
    if (!topic) {
      res.status(404).json({ error: "Temat nie znaleziony" });
      return;
    }

    const [video] = await db.select().from(videos).where(eq(videos.topicId, topicId)).limit(1);
    const [quizRow] = await db.select().from(quizzes).where(eq(quizzes.topicId, topicId)).limit(1);
    const taskList = await db.select().from(tasks).where(eq(tasks.topicId, topicId));

    let quizWithQuestions = null;
    if (quizRow) {
      const questionList = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizRow.id)).orderBy(asc(quizQuestions.sortOrder));
      const questionsWithAnswers = await Promise.all(
        questionList.map(async (q) => {
          // Student-facing DTO must not leak which answer is correct.
          const answerList = await db
            .select({
              id: quizAnswers.id,
              questionId: quizAnswers.questionId,
              answerLabel: quizAnswers.answerLabel,
              answerText: quizAnswers.answerText,
            })
            .from(quizAnswers)
            .where(eq(quizAnswers.questionId, q.id))
            .orderBy(asc(quizAnswers.answerLabel));
          return { ...q, answers: answerList };
        })
      );
      quizWithQuestions = { ...quizRow, questions: questionsWithAnswers };
    }

    res.json({
      ...topic,
      video: video ?? null,
      quiz: quizWithQuestions,
      tasks: taskList,
    });
  } catch (err) {
    req.log.error({ err }, "Get topic error");
    res.status(500).json({ error: "Błąd serwera" });
  }
  },
);

export default router;
