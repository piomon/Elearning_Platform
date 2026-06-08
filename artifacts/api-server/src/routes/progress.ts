import { Router } from "express";
import { db } from "@workspace/db";
import { learningProgress, topics, sections } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { userHasCourseAccess } from "../lib/access";

const router = Router();

// The client may only declare *where* it is in a lesson, never the completion
// flags. quizCompleted is set exclusively by routes/quizzes.ts after a real
// pass; taskCheckedByAi exclusively by routes/ai.ts after a real AI check;
// videoCompleted only via a genuine video event. courseId/sectionId are always
// derived server-side from the topic so the client can never grant itself
// progress in a course it has no access to.
const progressSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  currentElementType: z.enum(["video", "quiz", "task"]).optional(),
  videoCompleted: z.boolean().optional(),
});

router.get("/progress/me", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const progress = await db
      .select()
      .from(learningProgress)
      .where(eq(learningProgress.userId, req.user!.id));
    res.json(progress);
  } catch (err) {
    req.log.error({ err }, "Get progress error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/progress/summary", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(learningProgress)
      .where(eq(learningProgress.userId, req.user!.id));

    const summary = {
      startedTopics: rows.length,
      completedTopics: rows.filter((r) => r.status === "completed").length,
      videosCompleted: rows.filter((r) => r.videoCompleted).length,
      quizzesCompleted: rows.filter((r) => r.quizCompleted).length,
      tasksChecked: rows.filter((r) => r.taskCheckedByAi).length,
    };
    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Get progress summary error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/progress/continue", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const [latest] = await db
      .select()
      .from(learningProgress)
      .where(eq(learningProgress.userId, req.user!.id))
      .orderBy(desc(learningProgress.updatedAt))
      .limit(1);

    if (!latest) {
      res.json({
        topicId: null,
        sectionId: null,
        courseId: null,
        topicTitle: null,
        sectionTitle: null,
        currentElementType: null,
      });
      return;
    }

    const [topic] = await db
      .select({ id: topics.id, title: topics.title })
      .from(topics)
      .where(eq(topics.id, latest.topicId))
      .limit(1);
    let sectionTitle: string | null = null;
    if (latest.sectionId) {
      const [section] = await db
        .select({ title: sections.title })
        .from(sections)
        .where(eq(sections.id, latest.sectionId))
        .limit(1);
      sectionTitle = section?.title ?? null;
    }

    res.json({
      topicId: latest.topicId,
      sectionId: latest.sectionId,
      courseId: latest.courseId,
      topicTitle: topic?.title ?? null,
      sectionTitle,
      currentElementType: latest.currentElementType,
    });
  } catch (err) {
    req.log.error({ err }, "Get continue error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/progress", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Nieprawidłowe dane", details: parsed.error.issues });
      return;
    }
    const { topicId, currentElementType, videoCompleted } = parsed.data;

    // Derive section/course from the topic itself — never trust the client.
    const [topicRow] = await db
      .select({ sectionId: topics.sectionId, courseId: sections.courseId })
      .from(topics)
      .innerJoin(sections, eq(topics.sectionId, sections.id))
      .where(eq(topics.id, topicId))
      .limit(1);

    if (!topicRow) {
      res.status(404).json({ error: "Temat nie znaleziony" });
      return;
    }

    const isAdmin = req.user!.role === "admin";
    if (!isAdmin) {
      const hasAccess = await userHasCourseAccess(req.user!.id, topicRow.courseId);
      if (!hasAccess) {
        res
          .status(403)
          .json({ error: "Brak dostępu do kursu. Kup dostęp, aby kontynuować." });
        return;
      }
    }

    const markVideoCompleted = videoCompleted === true;

    const [result] = await db
      .insert(learningProgress)
      .values({
        userId: req.user!.id,
        courseId: topicRow.courseId,
        sectionId: topicRow.sectionId,
        topicId,
        currentElementType: currentElementType ?? null,
        videoCompleted: markVideoCompleted,
        quizCompleted: false,
        taskStarted: false,
        taskCheckedByAi: false,
        status: "in_progress",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [learningProgress.userId, learningProgress.topicId],
        set: {
          // Always safe to refresh from the (server-derived) topic.
          courseId: topicRow.courseId,
          sectionId: topicRow.sectionId,
          currentElementType: currentElementType ?? null,
          // Completion is monotonic: only ever flip false -> true, never reset.
          videoCompleted: sql`${learningProgress.videoCompleted} OR ${markVideoCompleted}`,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Upsert progress error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export default router;
