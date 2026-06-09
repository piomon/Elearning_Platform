import type { Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { topics, sections, quizzes, tasks, accessGrants } from "@workspace/db";
import { and, eq, or, gt, lte, isNull } from "drizzle-orm";
import type { AuthRequest } from "../middlewares/auth";

// Returns the owning course id and whether the topic is a free preview. Preview
// lessons are readable without a paid grant; access is still enforced here
// (server-side), the preview flag only widens what an authenticated user may see.
export async function getTopicAccessInfo(
  topicId: number,
): Promise<{ courseId: number; isPreview: boolean } | null> {
  if (!Number.isFinite(topicId)) return null;
  const [row] = await db
    .select({ courseId: sections.courseId, isPreview: topics.isPreview })
    .from(topics)
    .innerJoin(sections, eq(topics.sectionId, sections.id))
    .where(eq(topics.id, topicId))
    .limit(1);
  return row ? { courseId: row.courseId, isPreview: row.isPreview } : null;
}

export async function getCourseIdBySectionId(
  sectionId: number,
): Promise<number | null> {
  if (!Number.isFinite(sectionId)) return null;
  const [row] = await db
    .select({ courseId: sections.courseId })
    .from(sections)
    .where(eq(sections.id, sectionId))
    .limit(1);
  return row?.courseId ?? null;
}

export async function getCourseIdByTopicId(
  topicId: number,
): Promise<number | null> {
  if (!Number.isFinite(topicId)) return null;
  const [row] = await db
    .select({ courseId: sections.courseId })
    .from(topics)
    .innerJoin(sections, eq(topics.sectionId, sections.id))
    .where(eq(topics.id, topicId))
    .limit(1);
  return row?.courseId ?? null;
}

export async function getTopicLocation(
  topicId: number,
): Promise<{ courseId: number; sectionId: number } | null> {
  if (!Number.isFinite(topicId)) return null;
  const [row] = await db
    .select({ courseId: sections.courseId, sectionId: sections.id })
    .from(topics)
    .innerJoin(sections, eq(topics.sectionId, sections.id))
    .where(eq(topics.id, topicId))
    .limit(1);
  return row ? { courseId: row.courseId, sectionId: row.sectionId } : null;
}

export async function getCourseIdByQuizId(
  quizId: number,
): Promise<number | null> {
  if (!Number.isFinite(quizId)) return null;
  const [row] = await db
    .select({ courseId: sections.courseId })
    .from(quizzes)
    .innerJoin(topics, eq(quizzes.topicId, topics.id))
    .innerJoin(sections, eq(topics.sectionId, sections.id))
    .where(eq(quizzes.id, quizId))
    .limit(1);
  return row?.courseId ?? null;
}

export async function getCourseIdByTaskId(
  taskId: number,
): Promise<number | null> {
  if (!Number.isFinite(taskId)) return null;
  const [row] = await db
    .select({ courseId: sections.courseId })
    .from(tasks)
    .innerJoin(topics, eq(tasks.topicId, topics.id))
    .innerJoin(sections, eq(topics.sectionId, sections.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return row?.courseId ?? null;
}

function activeGrantConditions(userId: number, courseId?: number) {
  const now = new Date();
  const conditions = [
    eq(accessGrants.userId, userId),
    eq(accessGrants.status, "active"),
    lte(accessGrants.validFrom, now),
    or(isNull(accessGrants.validTo), gt(accessGrants.validTo, now)),
  ];
  if (typeof courseId === "number") {
    conditions.push(eq(accessGrants.courseId, courseId));
  }
  return and(...conditions);
}

export async function userHasCourseAccess(
  userId: number,
  courseId: number,
): Promise<boolean> {
  const [grant] = await db
    .select({ id: accessGrants.id })
    .from(accessGrants)
    .where(activeGrantConditions(userId, courseId))
    .limit(1);
  return Boolean(grant);
}

export async function getActiveAccessGrants(userId: number) {
  return db
    .select({
      id: accessGrants.id,
      courseId: accessGrants.courseId,
      source: accessGrants.source,
      status: accessGrants.status,
      validFrom: accessGrants.validFrom,
      validTo: accessGrants.validTo,
    })
    .from(accessGrants)
    .where(activeGrantConditions(userId));
}

type CourseIdResolver = (req: AuthRequest) => Promise<number | null> | number | null;

export function requireCourseAccess(resolve: CourseIdResolver) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Brak autoryzacji" });
      return;
    }
    let courseId: number | null = null;
    try {
      courseId = await resolve(req);
    } catch (err) {
      req.log.error({ err }, "Course access resolver error");
      courseId = null;
    }
    if (courseId === null || Number.isNaN(courseId)) {
      res.status(404).json({ error: "Zasób nie znaleziony" });
      return;
    }
    if (req.user.role === "admin") {
      next();
      return;
    }
    const ok = await userHasCourseAccess(req.user.id, courseId);
    if (!ok) {
      res
        .status(403)
        .json({ error: "Brak dostępu do kursu. Kup dostęp, aby kontynuować." });
      return;
    }
    next();
  };
}

// Like requireCourseAccess but resolves the topic from req.params[param] and
// lets a free-preview lesson through even without a paid grant. Admins always
// pass. Every other lesson still requires an active access grant.
export function requireTopicAccessOrPreview(param = "topicId") {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Brak autoryzacji" });
      return;
    }
    const topicId = Number(req.params[param] ?? req.body?.[param]);
    let info: { courseId: number; isPreview: boolean } | null = null;
    try {
      info = await getTopicAccessInfo(topicId);
    } catch (err) {
      req.log.error({ err }, "Topic access resolver error");
    }
    if (!info) {
      res.status(404).json({ error: "Zasób nie znaleziony" });
      return;
    }
    if (req.user.role === "admin" || info.isPreview) {
      next();
      return;
    }
    const ok = await userHasCourseAccess(req.user.id, info.courseId);
    if (!ok) {
      res
        .status(403)
        .json({ error: "Brak dostępu do kursu. Kup dostęp, aby kontynuować." });
      return;
    }
    next();
  };
}
