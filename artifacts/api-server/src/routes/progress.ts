import { Router } from "express";
import { db } from "@workspace/db";
import { learningProgress, topics, sections, courses } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/progress/me", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const progress = await db.select().from(learningProgress).where(eq(learningProgress.userId, req.user!.id));
    res.json(progress);
  } catch (err) {
    req.log.error({ err }, "Get progress error");
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
      res.json({ topicId: null, sectionId: null, courseId: null, topicTitle: null, sectionTitle: null, currentElementType: null });
      return;
    }

    const [topic] = await db.select({ id: topics.id, title: topics.title }).from(topics).where(eq(topics.id, latest.topicId)).limit(1);
    let sectionTitle = null;
    if (latest.sectionId) {
      const [section] = await db.select({ title: sections.title }).from(sections).where(eq(sections.id, latest.sectionId)).limit(1);
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
    const { courseId, sectionId, topicId, currentElementType, videoCompleted, quizCompleted, taskStarted, taskCheckedByAi } = req.body;
    if (!courseId || !topicId) {
      res.status(400).json({ error: "courseId i topicId są wymagane" });
      return;
    }

    const existing = await db.select({ id: learningProgress.id }).from(learningProgress).where(
      and(eq(learningProgress.userId, req.user!.id), eq(learningProgress.topicId, topicId))
    ).limit(1);

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
      updatedAt: new Date(),
    };

    let result;
    if (existing.length > 0) {
      const [updated] = await db.update(learningProgress).set(data).where(
        and(eq(learningProgress.userId, req.user!.id), eq(learningProgress.topicId, topicId))
      ).returning();
      result = updated;
    } else {
      const [created] = await db.insert(learningProgress).values(data).returning();
      result = created;
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Upsert progress error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export default router;
