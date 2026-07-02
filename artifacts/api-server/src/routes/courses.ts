import { Router } from "express";
import { db } from "@workspace/db";
import { courses, sections, topics, videos, lessonImages, quizzes, quizQuestions, quizAnswers, tasks } from "@workspace/db";
import { eq, asc, and, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import {
  requireCourseAccess,
  requireTopicAccessOrPreview,
  getCourseIdBySectionId,
  isSectionPublished,
  isTopicPublished,
} from "../lib/access";
import { buildVideoEmbedUrl } from "../lib/video";
import type { Request, Response, NextFunction } from "express";

const router = Router();

// Rejects route params that are not positive integers with a 400 before any
// access control runs, so callers get "bad request" (not "not found") for
// malformed ids like "abc" or "-1".
function requirePositiveIntParam(param: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const raw = req.params[param];
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      res.status(400).json({ error: `Nieprawidłowe ${param}` });
      return;
    }
    next();
  };
}

router.get("/courses", async (req, res) => {
  try {
    const all = await db.select().from(courses).where(eq(courses.status, "published"));
    res.json(all);
  } catch (err) {
    req.log.error({ err }, "List courses error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/courses/:slug", async (req, res) => {
  try {
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.slug, req.params.slug), eq(courses.status, "published")))
      .limit(1);
    if (!course) {
      res.status(404).json({ error: "Kurs nie znaleziony" });
      return;
    }
    const sectionList = await db
      .select()
      .from(sections)
      .where(and(eq(sections.courseId, course.id), eq(sections.status, "published")))
      .orderBy(asc(sections.sortOrder));
    if (sectionList.length === 0) {
      // Diagnostyka dla administratora: opublikowany kurs bez żadnych
      // opublikowanych działów prawie zawsze oznacza, że seed/import treści nie
      // został uruchomiony na tym środowisku (albo baza jest świeża/pusta).
      req.log.warn(
        { courseId: course.id, slug: course.slug },
        "Opublikowany kurs nie ma opublikowanych działów — uruchom import treści: docker compose exec api pnpm --filter @workspace/scripts run seed",
      );
    }
    const topicCounts = await Promise.all(
      sectionList.map(async (s) => {
        const ts = await db
          .select({ id: topics.id })
          .from(topics)
          .where(and(eq(topics.sectionId, s.id), eq(topics.status, "published")));
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

// Lesson list for a section. Returns metadata only (titles, preview flag, which
// element types exist) — never the actual gated content — so the course portal
// can render the full curriculum with lock badges to users without access.
router.get(
  "/sections/:sectionId/topics",
  requirePositiveIntParam("sectionId"),
  requireAuth as any,
  async (req: AuthRequest, res) => {
  try {
    const sectionId = Number(req.params.sectionId);
    // A hidden/draft/archived section (or one under a non-published course) has
    // no public outline — return an empty list, matching the non-existent-section
    // behaviour rather than leaking lesson titles.
    if (!(await isSectionPublished(sectionId))) {
      res.json([]);
      return;
    }
    const topicList = await db
      .select()
      .from(topics)
      .where(and(eq(topics.sectionId, sectionId), eq(topics.status, "published")))
      .orderBy(asc(topics.sortOrder), asc(topics.id));

    const enriched = await Promise.all(
      topicList.map(async (t) => {
        const [vid] = await db.select({ id: videos.id }).from(videos).where(eq(videos.topicId, t.id)).limit(1);
        const [quiz] = await db.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.topicId, t.id), eq(quizzes.status, "published"))).limit(1);
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
  },
);

router.get(
  "/topics/:topicId",
  requirePositiveIntParam("topicId"),
  requireAuth as any,
  requireTopicAccessOrPreview("topicId") as any,
  async (req: AuthRequest, res) => {
  try {
    const topicId = Number(req.params.topicId);
    const [topic] = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
    // Authoritative status cascade: the topic AND its section AND its course must
    // all be published, otherwise the lesson is not student-visible.
    if (!topic || !(await isTopicPublished(topicId))) {
      res.status(404).json({ error: "Temat nie znaleziony" });
      return;
    }

    const videoList = await db.select().from(videos).where(eq(videos.topicId, topicId)).orderBy(asc(videos.sortOrder), asc(videos.id));
    const imageList = await db.select().from(lessonImages).where(eq(lessonImages.topicId, topicId)).orderBy(asc(lessonImages.sortOrder), asc(lessonImages.id));
    const video = videoList[0];
    const [quizRow] = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.topicId, topicId), eq(quizzes.status, "published")))
      .limit(1);
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

    // Strip the teacher-only AI prompt config; students must never receive it.
    const publicTasks = taskList.map(({ aiPromptConfig: _omit, ...rest }) => rest);

    // Resolve the owning course and the neighbouring lessons within the same
    // section so the client never has to hardcode courseId or guess navigation.
    const [section] = await db
      .select({ courseId: sections.courseId })
      .from(sections)
      .where(eq(sections.id, topic.sectionId))
      .limit(1);

    const siblings = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.sectionId, topic.sectionId), eq(topics.status, "published")))
      .orderBy(asc(topics.sortOrder), asc(topics.id));
    const currentIndex = siblings.findIndex((s) => s.id === topic.id);
    const previousTopicId =
      currentIndex > 0 ? siblings[currentIndex - 1].id : null;
    const nextTopicId =
      currentIndex >= 0 && currentIndex < siblings.length - 1
        ? siblings[currentIndex + 1].id
        : null;

    res.json({
      ...topic,
      courseId: section?.courseId ?? null,
      previousTopicId,
      nextTopicId,
      // `video` kept for backwards compatibility (first video); `videos` is the
      // ordered full list the redesigned lesson page renders.
      video: video
        ? { ...video, embedUrl: buildVideoEmbedUrl(video) }
        : null,
      videos: videoList.map((v) => ({ ...v, embedUrl: buildVideoEmbedUrl(v) })),
      images: imageList,
      quiz: quizWithQuestions,
      tasks: publicTasks,
    });
  } catch (err) {
    req.log.error({ err }, "Get topic error");
    res.status(500).json({ error: "Błąd serwera" });
  }
  },
);

export default router;
