import { Router } from "express";
import { db } from "@workspace/db";
import { learningProgress, topics, sections, videos, videoProgress } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { userHasCourseAccess } from "../lib/access";

const router = Router();

// A video counts as "watched" once the student has reached this fraction of its
// length, so brief end-credits / buffering don't block completion.
const VIDEO_COMPLETE_PERCENT = 90;

// Anti-spoof: a video's recorded watch time can never exceed the real wall-clock
// time elapsed since the student first opened it, scaled by this tolerance (to
// absorb buffering, tab-throttled heartbeat bursts and minor clock skew) plus a
// fixed grace. This makes completion impossible to forge with one (or a burst
// of) fabricated calls — reaching the end always takes real elapsed time.
const WATCH_TIME_TOLERANCE = 1.5;
const WATCH_TIME_GRACE_SECONDS = 30;

// The client reports raw watch position; the server derives percent + completion
// and never trusts a client-sent "completed" flag, the duration denominator, or
// an un-bounded watch time. durationSeconds is intentionally NOT accepted — the
// completion denominator is always the server-stored video length.
const videoProgressSchema = z.object({
  videoId: z.coerce.number().int().positive(),
  watchedSeconds: z.coerce.number().min(0).max(60 * 60 * 12),
});

// The client may only declare *where* it is in a lesson, never any completion
// flag. videoCompleted is set exclusively by POST /progress/video from real
// watch telemetry; quizCompleted by routes/quizzes.ts after a real pass;
// taskCheckedByAi by routes/ai.ts after a real AI check. courseId/sectionId are
// always derived server-side from the topic so the client can never grant
// itself progress in a course it has no access to.
const progressSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  currentElementType: z.enum(["video", "quiz", "task"]).optional(),
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
    const { topicId, currentElementType } = parsed.data;

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

    // This route only records *navigation* (where the student is). It never
    // touches completion flags — those are set solely by the dedicated
    // video/quiz/AI routes from real events.
    const [result] = await db
      .insert(learningProgress)
      .values({
        userId: req.user!.id,
        courseId: topicRow.courseId,
        sectionId: topicRow.sectionId,
        topicId,
        currentElementType: currentElementType ?? null,
        videoCompleted: false,
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
          // Completion flags are deliberately not updated here.
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

router.post("/progress/video", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const parsed = videoProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Nieprawidłowe dane", details: parsed.error.issues });
      return;
    }
    const { videoId, watchedSeconds } = parsed.data;

    // Resolve the video, its topic, section and course server-side. Access (or
    // admin) is enforced before any watch time is recorded.
    const [row] = await db
      .select({
        videoId: videos.id,
        topicId: videos.topicId,
        videoDuration: videos.durationSeconds,
        sectionId: topics.sectionId,
        courseId: sections.courseId,
        isPreview: topics.isPreview,
      })
      .from(videos)
      .innerJoin(topics, eq(videos.topicId, topics.id))
      .innerJoin(sections, eq(topics.sectionId, sections.id))
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Wideo nie znalezione" });
      return;
    }

    const isAdmin = req.user!.role === "admin";
    if (!isAdmin && !row.isPreview) {
      const hasAccess = await userHasCourseAccess(req.user!.id, row.courseId);
      if (!hasAccess) {
        res
          .status(403)
          .json({ error: "Brak dostępu do kursu. Kup dostęp, aby kontynuować." });
        return;
      }
    }

    // The completion denominator is ALWAYS the server-stored video length. We
    // never accept a client-supplied duration, so a client can't shrink the
    // denominator to fake completion. If a video has no stored length we cannot
    // verify progress, so it simply never auto-completes (0%).
    const duration = row.videoDuration ?? null;

    // Anti-spoof cap: the recorded watch position can never exceed the real
    // wall-clock time elapsed since the row was first created (first open),
    // scaled by tolerance + grace. The first call has ~0 elapsed, so it is
    // capped to the grace window; reaching the end of a long video requires
    // genuine elapsed time accumulated across heartbeats and cannot be forged
    // by one — or a rapid burst of — fabricated requests.
    const now = Date.now();
    const [existing] = await db
      .select({
        watchedSeconds: videoProgress.watchedSeconds,
        createdAt: videoProgress.createdAt,
      })
      .from(videoProgress)
      .where(
        and(
          eq(videoProgress.userId, req.user!.id),
          eq(videoProgress.videoId, row.videoId),
        ),
      )
      .limit(1);

    const createdAt = existing?.createdAt ?? new Date(now);
    const elapsedSeconds = Math.max(0, (now - createdAt.getTime()) / 1000);
    const maxAllowedWatched =
      elapsedSeconds * WATCH_TIME_TOLERANCE + WATCH_TIME_GRACE_SECONDS;

    // Clamp to: the report, the real-time ceiling, and the video length. Watch
    // time only moves forward (never below a previously recorded position).
    let nextWatched = Math.min(watchedSeconds, maxAllowedWatched);
    if (duration) nextWatched = Math.min(nextWatched, duration);
    nextWatched = Math.max(nextWatched, existing?.watchedSeconds ?? 0);
    nextWatched = Math.round(nextWatched);

    const percent = duration && duration > 0
      ? Math.min(100, Math.round((nextWatched / duration) * 100))
      : 0;
    const completed = percent >= VIDEO_COMPLETE_PERCENT;

    const [saved] = await db
      .insert(videoProgress)
      .values({
        userId: req.user!.id,
        videoId: row.videoId,
        topicId: row.topicId,
        watchedSeconds: nextWatched,
        durationSeconds: duration,
        progressPercent: percent,
        completed,
      })
      .onConflictDoUpdate({
        target: [videoProgress.userId, videoProgress.videoId],
        set: {
          watchedSeconds: sql`GREATEST(${videoProgress.watchedSeconds}, ${nextWatched})`,
          durationSeconds: duration,
          progressPercent: sql`GREATEST(${videoProgress.progressPercent}, ${percent})`,
          completed: sql`${videoProgress.completed} OR ${completed}`,
          updatedAt: new Date(),
        },
      })
      .returning();

    // A lesson's videoCompleted flag flips true only once *every* video in the
    // topic is completed — derived from stored rows, never from the client.
    const topicVideos = await db
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.topicId, row.topicId));
    const completedRows = await db
      .select({ videoId: videoProgress.videoId })
      .from(videoProgress)
      .where(
        and(
          eq(videoProgress.userId, req.user!.id),
          eq(videoProgress.topicId, row.topicId),
          eq(videoProgress.completed, true),
        ),
      );
    const allVideosDone =
      topicVideos.length > 0 && completedRows.length >= topicVideos.length;

    if (allVideosDone) {
      await db
        .insert(learningProgress)
        .values({
          userId: req.user!.id,
          courseId: row.courseId,
          sectionId: row.sectionId,
          topicId: row.topicId,
          videoCompleted: true,
        })
        .onConflictDoUpdate({
          target: [learningProgress.userId, learningProgress.topicId],
          set: { videoCompleted: true, updatedAt: new Date() },
        });
    }

    res.json({ ...saved, allVideosCompleted: allVideosDone });
  } catch (err) {
    req.log.error({ err }, "Video progress error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export default router;
