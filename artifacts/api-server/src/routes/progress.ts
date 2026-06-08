import { Router } from "express";
import { db } from "@workspace/db";
import { learningProgress, topics, sections } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

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
    const {
      courseId,
      sectionId,
      topicId,
      currentElementType,
      videoCompleted,
      quizCompleted,
      taskStarted,
      taskCheckedByAi,
      status,
    } = req.body;
    if (!courseId || !topicId) {
      res.status(400).json({ error: "courseId i topicId są wymagane" });
      return;
    }

    const data = {
      userId: req.user!.id,
      courseId,
      sectionId: sectionId ?? null,
      topicId,
      currentElementType: currentElementType ?? null,
      videoCompleted: videoCompleted ?? false,
      quizCompleted: quizCompleted ?? false,
      taskStarted: taskStarted ?? false,
      taskCheckedByAi: taskCheckedByAi ?? false,
      status: status ?? "in_progress",
      updatedAt: new Date(),
    };

    const [result] = await db
      .insert(learningProgress)
      .values(data)
      .onConflictDoUpdate({
        target: [learningProgress.userId, learningProgress.topicId],
        set: {
          courseId: data.courseId,
          sectionId: data.sectionId,
          currentElementType: data.currentElementType,
          videoCompleted: data.videoCompleted,
          quizCompleted: data.quizCompleted,
          taskStarted: data.taskStarted,
          taskCheckedByAi: data.taskCheckedByAi,
          status: data.status,
          updatedAt: data.updatedAt,
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
