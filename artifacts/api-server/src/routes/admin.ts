import { Router } from "express";
import { db } from "@workspace/db";
import {
  users,
  loginEvents,
  courses,
  sections,
  topics,
  videos,
  quizzes,
  quizQuestions,
  quizAnswers,
  tasks,
  payments,
  paymentRefunds,
  accessGrants,
  contactMessages,
  adminLogs,
  learningProgress,
  landingSections,
  faqItems,
  seoSettings,
  pricingSettings,
  lessonImages,
  aiSettings,
  discountCodes,
  discountCodeUses,
  platformSettings,
} from "@workspace/db";
import { eq, ne, and, desc, asc, count, countDistinct, sum, gte, ilike, or, sql, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/auth";
import {
  SETTINGS_CATALOG,
  getSettingDef,
  getPlatformSettings,
  validateSetting,
} from "../lib/platform-settings";
import { DISCOUNT_TYPES, normalizeCode, type DiscountType } from "../lib/discounts";
import {
  probeBunnyVideo,
  mapWithConcurrency,
  listBunnyLibrary,
  extractBunnyGuid,
  type BunnyVideoHealth,
} from "../lib/bunny";
import { isBunnyConfigured, isGeminiConfigured, config } from "../config/env";
import { buildVideoEmbedUrl } from "../lib/video";
import { getPricingSettings, getSeoSettings } from "../lib/settings";
import { getAiSettings, resolveAiModel, DEFAULT_AI_SETTINGS } from "../lib/ai-settings";

const router = Router();

router.use(requireAuth as any, requireAdmin as any);

async function logAdminAction(
  adminId: number,
  action: string,
  entityType: string,
  entityId?: number,
  meta?: object
) {
  await db.insert(adminLogs).values({
    adminId,
    action,
    entityType,
    entityId: entityId ?? null,
    metadata: meta ?? null,
  });
}

const PUBLISH_STATUSES = ["draft", "published", "hidden", "archived"] as const;
type PublishStatus = (typeof PUBLISH_STATUSES)[number];

// Returns the value only when it is a valid publish status, otherwise null so
// callers can reject bad input or fall back to a sensible default.
function parseStatus(value: unknown): PublishStatus | null {
  return PUBLISH_STATUSES.includes(value as PublishStatus) ? (value as PublishStatus) : null;
}

const LESSON_DIFFICULTIES = ["easy", "medium", "hard"] as const;
type LessonDifficulty = (typeof LESSON_DIFFICULTIES)[number];
const ACCESS_TYPES = ["free", "paid", "admin"] as const;
type AccessType = (typeof ACCESS_TYPES)[number];

// Pull the optional lesson-meta fields out of a request body into a partial set
// of column values. Only keys explicitly present in the body are included, so
// the same helper works for both create (defaults apply) and update (untouched
// columns are left alone). `accessType` is mirrored into `isPreview` so the
// existing access checks (which read isPreview) stay correct: free => preview.
function parseLessonMeta(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("objectives" in body) out.objectives = body.objectives ?? null;
  if ("durationMinutes" in body)
    out.durationMinutes =
      body.durationMinutes === null || body.durationMinutes === undefined
        ? null
        : Number(body.durationMinutes);
  if ("difficulty" in body) {
    out.difficulty = LESSON_DIFFICULTIES.includes(body.difficulty as LessonDifficulty)
      ? body.difficulty
      : null;
  }
  if ("accessType" in body && ACCESS_TYPES.includes(body.accessType as AccessType)) {
    out.accessType = body.accessType;
    out.isPreview = body.accessType === "free";
  } else if ("isPreview" in body) {
    out.isPreview = Boolean(body.isPreview);
  }
  if ("thumbnailUrl" in body) out.thumbnailUrl = body.thumbnailUrl ?? null;
  if ("metaTitle" in body) out.metaTitle = body.metaTitle ?? null;
  if ("metaDescription" in body) out.metaDescription = body.metaDescription ?? null;
  if ("aiEnabled" in body) out.aiEnabled = Boolean(body.aiEnabled);
  return out;
}

// Extract the optional quiz settings columns from a request body. Booleans are
// only set when present; numerics are coerced and nullable where the schema
// allows unlimited (maxAttempts / timeLimitMinutes).
function parseQuizSettings(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("passThreshold" in body && body.passThreshold !== null && body.passThreshold !== undefined) {
    const v = Math.round(Number(body.passThreshold));
    if (Number.isFinite(v)) out.passThreshold = Math.min(100, Math.max(0, v));
  }
  if ("maxAttempts" in body)
    out.maxAttempts =
      body.maxAttempts === null || body.maxAttempts === undefined
        ? null
        : Math.max(1, Math.round(Number(body.maxAttempts)));
  if ("timeLimitMinutes" in body)
    out.timeLimitMinutes =
      body.timeLimitMinutes === null || body.timeLimitMinutes === undefined
        ? null
        : Math.max(1, Math.round(Number(body.timeLimitMinutes)));
  if ("shuffleQuestions" in body) out.shuffleQuestions = Boolean(body.shuffleQuestions);
  if ("shuffleAnswers" in body) out.shuffleAnswers = Boolean(body.shuffleAnswers);
  if ("showScore" in body) out.showScore = Boolean(body.showScore);
  if ("showCorrectAnswers" in body) out.showCorrectAnswers = Boolean(body.showCorrectAnswers);
  return out;
}

// A quiz may only be published when it is genuinely answerable: at least one
// question, every question with at least two answers, and exactly one correct
// answer per question. Returns a Polish error message when not publishable, or
// null when the quiz passes validation.
async function quizPublishBlocker(quizId: number): Promise<string | null> {
  const questions = await db
    .select({ id: quizQuestions.id })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId));
  if (questions.length === 0) {
    return "Nie można opublikować pustego quizu — dodaj co najmniej jedno pytanie";
  }

  const questionIds = questions.map((q) => q.id);
  const answers = await db
    .select({
      questionId: quizAnswers.questionId,
      isCorrect: quizAnswers.isCorrect,
    })
    .from(quizAnswers)
    .where(inArray(quizAnswers.questionId, questionIds));

  const countByQuestion = new Map<number, number>();
  const correctByQuestion = new Map<number, number>();
  for (const a of answers) {
    countByQuestion.set(a.questionId, (countByQuestion.get(a.questionId) ?? 0) + 1);
    if (a.isCorrect) {
      correctByQuestion.set(a.questionId, (correctByQuestion.get(a.questionId) ?? 0) + 1);
    }
  }

  for (const qId of questionIds) {
    if ((countByQuestion.get(qId) ?? 0) < 2) {
      return "Każde pytanie musi mieć co najmniej dwie odpowiedzi";
    }
    if ((correctByQuestion.get(qId) ?? 0) !== 1) {
      return "Każde pytanie musi mieć dokładnie jedną poprawną odpowiedź";
    }
  }

  return null;
}

// Apply a client-supplied ordering of ids to a set of rows by writing the array
// index into each row's sortOrder. Generic over any table that has id +
// sortOrder. Runs in a single transaction so the reorder is atomic. When a
// `scope` is supplied (a parent column + value) every update is additionally
// constrained to that parent, so a malformed payload can never reorder rows
// belonging to a different parent entity.
async function applyReorder(
  table: any,
  ids: unknown,
  scope?: { column: any; value: number },
): Promise<{ ok: boolean }> {
  if (!Array.isArray(ids) || ids.some((n) => !Number.isInteger(Number(n)))) {
    return { ok: false };
  }
  const numeric = ids.map((n) => Number(n));
  await db.transaction(async (tx) => {
    for (let i = 0; i < numeric.length; i++) {
      const idMatch = eq(table.id, numeric[i]);
      await tx
        .update(table)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(scope ? and(idMatch, eq(scope.column, scope.value)) : idMatch);
    }
  });
  return { ok: true };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/admin/dashboard", async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(users);
    const [{ usersWithAccess }] = await db
      .select({ usersWithAccess: countDistinct(accessGrants.userId) })
      .from(accessGrants)
      .where(eq(accessGrants.status, "active"));
    const [{ activeAccess }] = await db
      .select({ activeAccess: count() })
      .from(accessGrants)
      .where(eq(accessGrants.status, "active"));

    const [{ totalPayments }] = await db.select({ totalPayments: count() }).from(payments);
    const [{ completedPayments }] = await db
      .select({ completedPayments: count() })
      .from(payments)
      .where(eq(payments.status, "completed"));
    const [{ failedPayments }] = await db
      .select({ failedPayments: count() })
      .from(payments)
      .where(eq(payments.status, "failed"));

    const [{ revenue }] = await db
      .select({ revenue: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.status, "completed"));
    const [{ revenue7d }] = await db
      .select({ revenue7d: sum(payments.amount) })
      .from(payments)
      .where(and(eq(payments.status, "completed"), gte(payments.createdAt, d7)));
    const [{ revenue30d }] = await db
      .select({ revenue30d: sum(payments.amount) })
      .from(payments)
      .where(and(eq(payments.status, "completed"), gte(payments.createdAt, d30)));

    const [{ totalTopics }] = await db.select({ totalTopics: count() }).from(topics);
    const [{ publishedTopics }] = await db
      .select({ publishedTopics: count() })
      .from(topics)
      .where(eq(topics.status, "published"));
    const [{ hiddenTopics }] = await db
      .select({ hiddenTopics: count() })
      .from(topics)
      .where(eq(topics.status, "hidden"));
    const [{ draftTopics }] = await db
      .select({ draftTopics: count() })
      .from(topics)
      .where(eq(topics.status, "draft"));
    const [{ totalQuizzes }] = await db.select({ totalQuizzes: count() }).from(quizzes);

    const [{ totalMessages }] = await db.select({ totalMessages: count() }).from(contactMessages);
    const [{ newMessages }] = await db
      .select({ newMessages: count() })
      .from(contactMessages)
      .where(eq(contactMessages.status, "new"));

    const recentLoginsRaw = await db
      .select({
        id: loginEvents.id,
        userId: loginEvents.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        loginAt: loginEvents.createdAt,
        ipAddress: loginEvents.ipAddress,
      })
      .from(loginEvents)
      .leftJoin(users, eq(loginEvents.userId, users.id))
      .orderBy(desc(loginEvents.createdAt))
      .limit(10);
    const recentLogins = recentLoginsRaw.map((l) => ({
      userId: l.userId,
      email: l.email ?? "",
      firstName: l.firstName ?? "",
      lastName: l.lastName ?? "",
      loginAt: l.loginAt,
    }));

    const recentMessages = await db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt))
      .limit(5);

    const recentPaymentsRaw = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        createdAt: payments.createdAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .orderBy(desc(payments.createdAt))
      .limit(5);
    const recentPayments = recentPaymentsRaw.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      email: p.email ?? "",
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
    }));

    const recentUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(5);

    const recentTopicsRaw = await db
      .select({
        id: topics.id,
        title: topics.title,
        status: topics.status,
        updatedAt: topics.updatedAt,
        sectionTitle: sections.title,
      })
      .from(topics)
      .leftJoin(sections, eq(topics.sectionId, sections.id))
      .orderBy(desc(topics.updatedAt))
      .limit(5);
    const recentTopics = recentTopicsRaw.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      updatedAt: t.updatedAt,
      sectionTitle: t.sectionTitle ?? "",
    }));

    res.json({
      totalUsers,
      usersWithAccess,
      usersWithoutAccess: Math.max(0, totalUsers - usersWithAccess),
      activeAccess,
      totalPayments,
      completedPayments,
      failedPayments,
      totalRevenue: Number(revenue ?? 0),
      revenue7d: Number(revenue7d ?? 0),
      revenue30d: Number(revenue30d ?? 0),
      totalTopics,
      publishedTopics,
      hiddenTopics,
      draftTopics,
      totalQuizzes,
      totalMessages,
      newMessages,
      recentLogins,
      recentMessages,
      recentPayments,
      recentUsers,
      recentTopics,
    });
  } catch (err) {
    req.log.error({ err }, "Admin dashboard error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get("/admin/users", async (req: AuthRequest, res) => {
  try {
    const { search, filter } = req.query as { search?: string; filter?: string };
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    let userList = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isBanned: users.isBanned,
        bannedReason: users.bannedReason,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // Apply search filter
    if (search) {
      userList = userList.filter(
        (u) =>
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.firstName.toLowerCase().includes(search.toLowerCase()) ||
          u.lastName.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply banned status filter pre-enrichment
    if (filter === "banned") userList = userList.filter((u) => u.isBanned);

    // Enrich with access status
    const enriched = await Promise.all(
      userList.map(async (u) => {
        const [grant] = await db
          .select({ id: accessGrants.id })
          .from(accessGrants)
          .where(and(eq(accessGrants.userId, u.id), eq(accessGrants.status, "active")))
          .limit(1);
        return { ...u, hasAccess: !!grant };
      })
    );

    // Apply access-based filters post-enrichment
    let finalList = enriched;
    if (filter === "active") finalList = enriched.filter((u) => u.hasAccess && !u.isBanned);
    else if (filter === "no_access") finalList = enriched.filter((u) => !u.hasAccess && !u.isBanned);

    const total = finalList.length;
    const start = (page - 1) * limit;
    const paged = finalList.slice(start, start + limit);

    res.json({
      users: paged,
      total,
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Admin list users error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/admin/users/:id", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isBanned: users.isBanned,
        bannedReason: users.bannedReason,
        bannedAt: users.bannedAt,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Użytkownik nie znaleziony" });
      return;
    }

    const [grant] = await db
      .select()
      .from(accessGrants)
      .where(and(eq(accessGrants.userId, userId), eq(accessGrants.status, "active")))
      .limit(1);

    const userPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));

    const progress = await db
      .select()
      .from(learningProgress)
      .where(eq(learningProgress.userId, userId));

    const logs = await db
      .select()
      .from(adminLogs)
      .where(and(eq(adminLogs.entityType, "user"), eq(adminLogs.entityId, userId)))
      .orderBy(desc(adminLogs.createdAt))
      .limit(20);

    res.json({
      ...user,
      hasAccess: !!grant,
      accessGrant: grant ?? null,
      payments: userPayments,
      progress,
      adminLogs: logs,
    });
  } catch (err) {
    req.log.error({ err }, "Admin get user error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/admin/users/:id/login-stats/:month", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const month = String(req.params.month); // format: "2026-01"
    const [year, m] = month.split("-").map(Number);

    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 1);

    const events = await db
      .select({
        id: loginEvents.id,
        ipAddress: loginEvents.ipAddress,
        userAgent: loginEvents.userAgent,
        createdAt: loginEvents.createdAt,
      })
      .from(loginEvents)
      .where(
        and(
          eq(loginEvents.userId, userId),
          sql`${loginEvents.createdAt} >= ${start}`,
          sql`${loginEvents.createdAt} < ${end}`
        )
      )
      .orderBy(desc(loginEvents.createdAt));

    res.json({ userId, month, count: events.length, events });
  } catch (err) {
    req.log.error({ err }, "Login stats error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/users/:id/ban", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { reason } = req.body;

    await db
      .update(users)
      .set({ isBanned: true, bannedReason: reason ?? null, bannedAt: new Date() })
      .where(eq(users.id, userId));

    await logAdminAction(req.user!.id, "ban", "user", userId, { reason });
    res.json({ message: "Użytkownik zablokowany" });
  } catch (err) {
    req.log.error({ err }, "Ban user error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/users/:id/unban", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    await db
      .update(users)
      .set({ isBanned: false, bannedReason: null, bannedAt: null })
      .where(eq(users.id, userId));

    await logAdminAction(req.user!.id, "unban", "user", userId);
    res.json({ message: "Użytkownik odblokowany" });
  } catch (err) {
    req.log.error({ err }, "Unban user error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/users/:id/access", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const { courseId, validTo } = req.body;
    const cId = Number(courseId);
    if (!Number.isInteger(cId) || cId <= 0) {
      res.status(400).json({ error: "Nieprawidłowy identyfikator kursu" });
      return;
    }

    const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, cId)).limit(1);
    if (!course) {
      res.status(404).json({ error: "Kurs nie znaleziony" });
      return;
    }

    const [existing] = await db
      .select({ id: accessGrants.id })
      .from(accessGrants)
      .where(and(eq(accessGrants.userId, userId), eq(accessGrants.courseId, cId), eq(accessGrants.status, "active")))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Użytkownik już ma dostęp do tego kursu" });
      return;
    }

    await db.insert(accessGrants).values({
      userId,
      courseId: cId,
      source: "admin",
      grantedByAdminId: req.user!.id,
      status: "active",
      validFrom: new Date(),
      validTo: validTo ? new Date(validTo) : null,
    });

    await logAdminAction(req.user!.id, "grant_access", "user", userId, { courseId: cId });
    res.status(201).json({ message: "Dostęp przyznany" });
  } catch (err) {
    req.log.error({ err }, "Grant access error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/users/:id/access", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    await db
      .update(accessGrants)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(and(eq(accessGrants.userId, userId), eq(accessGrants.status, "active")));

    await logAdminAction(req.user!.id, "revoke_access", "user", userId);
    res.json({ message: "Dostęp cofnięty" });
  } catch (err) {
    req.log.error({ err }, "Revoke access error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Payments ──────────────────────────────────────────────────────────────────

router.get("/admin/payments", async (req: AuthRequest, res) => {
  try {
    const { status } = req.query as { status?: string };
    let query = db
      .select({
        id: payments.id,
        userId: payments.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        provider: payments.provider,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .orderBy(desc(payments.createdAt))
      .$dynamic();

    const result = await query;
    if (status) {
      res.json(result.filter((p) => p.status === status));
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Admin payments error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/payments/:paymentId/refund", async (req: AuthRequest, res) => {
  try {
    const paymentId = Number(req.params.paymentId);
    const { reason } = req.body;

    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) {
      res.status(404).json({ error: "Płatność nie znaleziona" });
      return;
    }
    if (payment.status !== "completed") {
      res.status(400).json({ error: "Można zwrócić tylko zakończone płatności" });
      return;
    }

    const [refund] = await db
      .insert(paymentRefunds)
      .values({
        paymentId,
        userId: payment.userId,
        adminId: req.user!.id,
        provider: payment.provider,
        amount: payment.amount,
        status: "manual",
        reason: reason ?? null,
      })
      .returning();

    await db.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(eq(payments.id, paymentId));
    await db
      .update(accessGrants)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(and(eq(accessGrants.paymentId, paymentId), eq(accessGrants.status, "active")));

    await logAdminAction(req.user!.id, "refund", "payment", paymentId, {
      reason,
      amount: payment.amount,
      type: "manual",
    });
    res.json({
      status: "manual",
      message:
        "Zwrot ręczny odnotowany. Wykonaj rzeczywisty zwrot środków w panelu operatora płatności.",
      refundId: refund.id,
    });
  } catch (err) {
    req.log.error({ err }, "Refund error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Contact Messages ──────────────────────────────────────────────────────────

router.get("/admin/contact-messages", async (req: AuthRequest, res) => {
  try {
    const { status } = req.query as { status?: string };
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    let msgs = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
    if (status) msgs = msgs.filter((m) => m.status === status);
    const total = msgs.length;
    const start = (page - 1) * limit;
    res.json({ messages: msgs.slice(start, start + limit), total, page, limit });
  } catch (err) {
    req.log.error({ err }, "List contact messages error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.patch("/admin/contact-messages/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const [updated] = await db
      .update(contactMessages)
      .set({ status, updatedAt: new Date() })
      .where(eq(contactMessages.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Wiadomość nie znaleziona" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update contact message error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Admin Logs ────────────────────────────────────────────────────────────────

router.get("/admin/logs", async (req: AuthRequest, res) => {
  try {
    const { action, entityType } = req.query as { action?: string; entityType?: string };
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const conds = [];
    if (action) conds.push(eq(adminLogs.action, action));
    if (entityType) conds.push(eq(adminLogs.entityType, entityType));
    const whereExpr = conds.length ? and(...conds) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(adminLogs)
      .where(whereExpr);

    const logs = await db
      .select({
        id: adminLogs.id,
        adminId: adminLogs.adminId,
        adminEmail: users.email,
        adminFirstName: users.firstName,
        action: adminLogs.action,
        entityType: adminLogs.entityType,
        entityId: adminLogs.entityId,
        metadata: adminLogs.metadata,
        createdAt: adminLogs.createdAt,
      })
      .from(adminLogs)
      .leftJoin(users, eq(adminLogs.adminId, users.id))
      .where(whereExpr)
      .orderBy(desc(adminLogs.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
    res.json({ logs, total: Number(total), page, limit });
  } catch (err) {
    req.log.error({ err }, "List admin logs error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Course CMS ────────────────────────────────────────────────────────────────

router.get("/admin/courses", async (req: AuthRequest, res) => {
  try {
    const courseList = await db.select().from(courses).orderBy(desc(courses.createdAt));
    const enriched = await Promise.all(
      courseList.map(async (c) => {
        const sectionList = await db.select().from(sections).where(eq(sections.courseId, c.id)).orderBy(asc(sections.sortOrder));
        const sectionsEnriched = await Promise.all(
          sectionList.map(async (s) => {
            const topicList = await db.select().from(topics).where(eq(topics.sectionId, s.id)).orderBy(asc(topics.sortOrder));
            const topicsEnriched = await Promise.all(
              topicList.map(async (t) => {
                const [vid] = await db.select().from(videos).where(eq(videos.topicId, t.id)).limit(1);
                const [quiz] = await db.select().from(quizzes).where(eq(quizzes.topicId, t.id)).limit(1);
                const taskList = await db.select().from(tasks).where(eq(tasks.topicId, t.id));
                const imageList = await db.select().from(lessonImages).where(eq(lessonImages.topicId, t.id)).orderBy(asc(lessonImages.sortOrder));
                let quizDetail = null;
                if (quiz) {
                  const qqs = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(asc(quizQuestions.sortOrder));
                  const qqsWithAnswers = await Promise.all(
                    qqs.map(async (q) => {
                      const answers = await db.select().from(quizAnswers).where(eq(quizAnswers.questionId, q.id));
                      return { ...q, answers };
                    })
                  );
                  quizDetail = { ...quiz, questions: qqsWithAnswers };
                }
                return { ...t, video: vid ?? null, quiz: quizDetail, tasks: taskList, images: imageList };
              })
            );
            return { ...s, topics: topicsEnriched };
          })
        );
        return { ...c, sections: sectionsEnriched };
      })
    );
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Admin list courses error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/courses", async (req: AuthRequest, res) => {
  try {
    const { title, slug, description, status, isPublished } = req.body;
    const st = parseStatus(status) ?? (isPublished ? "published" : "draft");
    const [course] = await db.insert(courses).values({ title, slug, description: description ?? "", status: st, isPublished: st === "published" }).returning();
    await logAdminAction(req.user!.id, "create", "course", course.id, { title });
    res.status(201).json(course);
  } catch (err) {
    req.log.error({ err }, "Create course error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/courses/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { title, slug, description, status, isPublished } = req.body;
    const st = parseStatus(status) ?? (isPublished ? "published" : "draft");
    const [updated] = await db.update(courses).set({ title, slug, description, status: st, isPublished: st === "published", updatedAt: new Date() }).where(eq(courses.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Kurs nie znaleziony" }); return; }
    await logAdminAction(req.user!.id, "update", "course", id, { title });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update course error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/courses/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(courses).where(eq(courses.id, id));
    await logAdminAction(req.user!.id, "delete", "course", id);
    res.json({ message: "Kurs usunięty" });
  } catch (err) {
    req.log.error({ err }, "Delete course error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Sections
router.post("/admin/sections", async (req: AuthRequest, res) => {
  try {
    const { courseId, title, slug, sortOrder } = req.body;
    const [s] = await db.insert(sections).values({ courseId, title, slug, sortOrder: sortOrder ?? 0 }).returning();
    await logAdminAction(req.user!.id, "create", "section", s.id, { title, courseId });
    res.status(201).json(s);
  } catch (err) {
    req.log.error({ err }, "Create section error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/sections/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { title, slug, sortOrder } = req.body;
    const [updated] = await db.update(sections).set({ title, slug, sortOrder, updatedAt: new Date() }).where(eq(sections.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Dział nie znaleziony" }); return; }
    await logAdminAction(req.user!.id, "update", "section", id);
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update section error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/sections/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(sections).where(eq(sections.id, id));
    await logAdminAction(req.user!.id, "delete", "section", id);
    res.json({ message: "Dział usunięty" });
  } catch (err) {
    req.log.error({ err }, "Delete section error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Topics
router.post("/admin/topics", async (req: AuthRequest, res) => {
  try {
    const { sectionId, title, slug, description, sortOrder, status } = req.body;
    const st = parseStatus(status);
    const [t] = await db
      .insert(topics)
      .values({
        sectionId,
        title,
        slug,
        description,
        sortOrder: sortOrder ?? 0,
        ...(st ? { status: st } : {}),
        ...parseLessonMeta(req.body),
      })
      .returning();
    await logAdminAction(req.user!.id, "create", "topic", t.id, { title, sectionId });
    res.status(201).json(t);
  } catch (err) {
    req.log.error({ err }, "Create topic error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/topics/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { title, slug, description, sortOrder, status } = req.body;
    const st = parseStatus(status);
    const [updated] = await db
      .update(topics)
      .set({
        title,
        slug,
        description,
        sortOrder,
        ...(st ? { status: st } : {}),
        ...parseLessonMeta(req.body),
        updatedAt: new Date(),
      })
      .where(eq(topics.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Temat nie znaleziony" }); return; }
    await logAdminAction(req.user!.id, "update", "topic", id);
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update topic error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/topics/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(topics).where(eq(topics.id, id));
    await logAdminAction(req.user!.id, "delete", "topic", id);
    res.json({ message: "Temat usunięty" });
  } catch (err) {
    req.log.error({ err }, "Delete topic error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Videos
router.post("/admin/videos", async (req: AuthRequest, res) => {
  try {
    const { topicId, bunnyVideoId, videoUrl, title, durationSeconds } = req.body;
    const [v] = await db.insert(videos).values({ topicId, bunnyVideoId, videoUrl, title, durationSeconds }).returning();
    await logAdminAction(req.user!.id, "create", "video", v.id, { topicId, title });
    res.status(201).json(v);
  } catch (err) {
    req.log.error({ err }, "Create video error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/videos/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { bunnyVideoId, videoUrl, title, durationSeconds } = req.body;
    const [updated] = await db.update(videos).set({ bunnyVideoId, videoUrl, title, durationSeconds, updatedAt: new Date() }).where(eq(videos.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Film nie znaleziony" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update video error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/videos/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(videos).where(eq(videos.id, id));
    await logAdminAction(req.user!.id, "delete", "video", id);
    res.json({ message: "Film usunięty" });
  } catch (err) {
    req.log.error({ err }, "Delete video error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Quizzes
router.post("/admin/quizzes", async (req: AuthRequest, res) => {
  try {
    const { topicId, title, status } = req.body;
    const st = parseStatus(status);
    const [q] = await db
      .insert(quizzes)
      .values({ topicId, title, ...(st ? { status: st } : {}), ...parseQuizSettings(req.body) })
      .returning();
    await logAdminAction(req.user!.id, "create", "quiz", q.id, { topicId, title });
    res.status(201).json(q);
  } catch (err) {
    req.log.error({ err }, "Create quiz error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/quizzes/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { title, status } = req.body;
    const st = parseStatus(status);
    if (st === "published") {
      const blocker = await quizPublishBlocker(id);
      if (blocker) { res.status(400).json({ error: blocker }); return; }
    }
    const [updated] = await db
      .update(quizzes)
      .set({ title, ...(st ? { status: st } : {}), ...parseQuizSettings(req.body), updatedAt: new Date() })
      .where(eq(quizzes.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Quiz nie znaleziony" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update quiz error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/quizzes/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(quizzes).where(eq(quizzes.id, id));
    await logAdminAction(req.user!.id, "delete", "quiz", id);
    res.json({ message: "Quiz usunięty" });
  } catch (err) {
    req.log.error({ err }, "Delete quiz error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Quiz Questions
router.post("/admin/quizzes/:id/questions", async (req: AuthRequest, res) => {
  try {
    const quizId = Number(req.params.id);
    const { questionText, sortOrder, explanation, points } = req.body;
    const [q] = await db
      .insert(quizQuestions)
      .values({
        quizId,
        questionText,
        sortOrder: sortOrder ?? 0,
        ...("explanation" in req.body ? { explanation: explanation ?? null } : {}),
        ...(points !== undefined && points !== null
          ? { points: Math.max(1, Math.round(Number(points))) }
          : {}),
      })
      .returning();
    res.status(201).json(q);
  } catch (err) {
    req.log.error({ err }, "Create question error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/questions/:questionId", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.questionId);
    const { questionText, sortOrder, explanation, points } = req.body;
    const [updated] = await db
      .update(quizQuestions)
      .set({
        questionText,
        sortOrder,
        ...("explanation" in req.body ? { explanation: explanation ?? null } : {}),
        ...(points !== undefined && points !== null
          ? { points: Math.max(1, Math.round(Number(points))) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(quizQuestions.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Pytanie nie znalezione" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update question error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/questions/:questionId", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.questionId);
    await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
    res.json({ message: "Pytanie usunięte" });
  } catch (err) {
    req.log.error({ err }, "Delete question error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Quiz Answers
const ANSWER_LABELS = ["A", "B", "C", "D"] as const;

router.post("/admin/questions/:questionId/answers", async (req: AuthRequest, res) => {
  try {
    const questionId = Number(req.params.questionId);
    const { answerLabel, answerText, isCorrect } = req.body;

    // Enforce the A–D answer model expected by the student quiz UI.
    if (!ANSWER_LABELS.includes(answerLabel)) {
      res.status(400).json({ error: "Etykieta odpowiedzi musi być jedną z: A, B, C, D" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const siblings = await tx
        .select({ id: quizAnswers.id, answerLabel: quizAnswers.answerLabel })
        .from(quizAnswers)
        .where(eq(quizAnswers.questionId, questionId));

      if (siblings.length >= ANSWER_LABELS.length) {
        return { tooMany: true } as const;
      }
      if (siblings.some((s) => s.answerLabel === answerLabel)) {
        return { duplicate: true } as const;
      }

      const [created] = await tx
        .insert(quizAnswers)
        .values({ questionId, answerLabel, answerText, isCorrect: isCorrect ?? false, sortOrder: siblings.length })
        .returning();
      // Enforce exactly one correct answer per question.
      if (isCorrect) {
        await tx
          .update(quizAnswers)
          .set({ isCorrect: false, updatedAt: new Date() })
          .where(and(eq(quizAnswers.questionId, questionId), ne(quizAnswers.id, created.id)));
      }
      return { answer: created } as const;
    });

    if ("tooMany" in result) {
      res.status(400).json({ error: "Pytanie może mieć maksymalnie 4 odpowiedzi (A–D)" });
      return;
    }
    if ("duplicate" in result) {
      res.status(409).json({ error: "Odpowiedź z tą etykietą już istnieje" });
      return;
    }
    await logAdminAction(req.user!.id, "create", "quiz_answer", result.answer.id);
    res.status(201).json(result.answer);
  } catch (err) {
    req.log.error({ err }, "Create answer error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/answers/:answerId", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.answerId);
    const { answerLabel, answerText, isCorrect } = req.body;
    if (answerLabel !== undefined && !ANSWER_LABELS.includes(answerLabel)) {
      res.status(400).json({ error: "Etykieta odpowiedzi musi być jedną z: A, B, C, D" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(quizAnswers)
        .where(eq(quizAnswers.id, id))
        .limit(1);
      if (!existing) return { notFound: true } as const;
      if (answerLabel !== undefined && answerLabel !== existing.answerLabel) {
        const [dup] = await tx
          .select({ id: quizAnswers.id })
          .from(quizAnswers)
          .where(and(eq(quizAnswers.questionId, existing.questionId), eq(quizAnswers.answerLabel, answerLabel), ne(quizAnswers.id, id)))
          .limit(1);
        if (dup) return { duplicate: true } as const;
      }
      // Prevent leaving the question with zero correct answers.
      if (existing.isCorrect && !isCorrect) {
        const [other] = await tx
          .select({ id: quizAnswers.id })
          .from(quizAnswers)
          .where(and(eq(quizAnswers.questionId, existing.questionId), eq(quizAnswers.isCorrect, true), ne(quizAnswers.id, id)))
          .limit(1);
        if (!other) return { invalid: true } as const;
      }
      const [u] = await tx
        .update(quizAnswers)
        .set({ answerLabel, answerText, isCorrect, updatedAt: new Date() })
        .where(eq(quizAnswers.id, id))
        .returning();
      // Enforce exactly one correct answer per question.
      if (u && isCorrect) {
        await tx
          .update(quizAnswers)
          .set({ isCorrect: false, updatedAt: new Date() })
          .where(and(eq(quizAnswers.questionId, u.questionId), ne(quizAnswers.id, u.id)));
      }
      return { answer: u } as const;
    });
    if ("notFound" in result) { res.status(404).json({ error: "Odpowiedź nie znaleziona" }); return; }
    if ("duplicate" in result) { res.status(409).json({ error: "Odpowiedź z tą etykietą już istnieje" }); return; }
    if ("invalid" in result) { res.status(400).json({ error: "Pytanie musi mieć co najmniej jedną poprawną odpowiedź" }); return; }
    await logAdminAction(req.user!.id, "update", "quiz_answer", id);
    res.json(result.answer);
  } catch (err) {
    req.log.error({ err }, "Update answer error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/answers/:answerId", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.answerId);
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(quizAnswers)
        .where(eq(quizAnswers.id, id))
        .limit(1);
      if (!existing) return { notFound: true } as const;
      // Prevent deleting the only correct answer while other answers remain.
      if (existing.isCorrect) {
        const others = await tx
          .select({ id: quizAnswers.id, isCorrect: quizAnswers.isCorrect })
          .from(quizAnswers)
          .where(and(eq(quizAnswers.questionId, existing.questionId), ne(quizAnswers.id, id)));
        if (others.length > 0 && !others.some((o) => o.isCorrect)) {
          return { invalid: true } as const;
        }
      }
      await tx.delete(quizAnswers).where(eq(quizAnswers.id, id));
      return { ok: true } as const;
    });
    if ("notFound" in result) { res.status(404).json({ error: "Odpowiedź nie znaleziona" }); return; }
    if ("invalid" in result) { res.status(400).json({ error: "Nie można usunąć jedynej poprawnej odpowiedzi. Najpierw wskaż inną poprawną odpowiedź." }); return; }
    res.json({ message: "Odpowiedź usunięta" });
  } catch (err) {
    req.log.error({ err }, "Delete answer error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Tasks
router.post("/admin/tasks", async (req: AuthRequest, res) => {
  try {
    const { topicId, title, description, initialImageUrl, aiPromptConfig } = req.body;
    const [t] = await db.insert(tasks).values({ topicId, title, description, initialImageUrl, aiPromptConfig }).returning();
    await logAdminAction(req.user!.id, "create", "task", t.id, { topicId, title });
    res.status(201).json(t);
  } catch (err) {
    req.log.error({ err }, "Create task error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/tasks/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, initialImageUrl, aiPromptConfig } = req.body;
    const [updated] = await db.update(tasks).set({ title, description, initialImageUrl, aiPromptConfig, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Zadanie nie znalezione" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update task error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/tasks/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(tasks).where(eq(tasks.id, id));
    await logAdminAction(req.user!.id, "delete", "task", id);
    res.json({ message: "Zadanie usunięte" });
  } catch (err) {
    req.log.error({ err }, "Delete task error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ─── VIDEO HEALTH (Bunny diagnostics) ────────────────────────────────────────

// Lists every video in the catalogue alongside its live Bunny encode status so
// an admin can spot missing/failed/processing videos at /admin/course-debug.
router.get("/admin/video-health", async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        id: videos.id,
        title: videos.title,
        bunnyVideoId: videos.bunnyVideoId,
        videoUrl: videos.videoUrl,
        topicId: videos.topicId,
        topicTitle: topics.title,
        sectionTitle: sections.title,
        sortOrder: videos.sortOrder,
      })
      .from(videos)
      .innerJoin(topics, eq(videos.topicId, topics.id))
      .innerJoin(sections, eq(topics.sectionId, sections.id))
      .orderBy(asc(sections.sortOrder), asc(topics.sortOrder), asc(videos.sortOrder));

    const bunnyConfigured = isBunnyConfigured();

    const items = await mapWithConcurrency(rows, 5, async (row) => {
      let health: BunnyVideoHealth | null = null;
      if (bunnyConfigured && row.bunnyVideoId) {
        health = await probeBunnyVideo(row.bunnyVideoId);
      }
      const available = health?.ok ? health.available : false;
      return {
        id: row.id,
        title: row.title,
        topicId: row.topicId,
        topicTitle: row.topicTitle,
        sectionTitle: row.sectionTitle,
        bunnyVideoId: row.bunnyVideoId,
        hasEmbed: Boolean(buildVideoEmbedUrl(row)),
        available,
        status: health?.ok ? health.status : null,
        statusLabel: health?.ok
          ? health.statusLabel
          : health
            ? health.error
            : row.bunnyVideoId
              ? "Bunny nie jest skonfigurowane"
              : "Brak ID wideo Bunny",
      };
    });

    const summary = {
      total: items.length,
      available: items.filter((i) => i.available).length,
      missingBunnyId: items.filter((i) => !i.bunnyVideoId).length,
      bunnyConfigured,
    };

    res.json({ summary, items });
  } catch (err) {
    req.log.error({ err }, "Video health error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Detailed live probe for a single video, including the resolved embed URL.
router.get("/admin/video-health/:videoId", async (req: AuthRequest, res) => {
  try {
    const videoId = Number(req.params.videoId);
    if (!Number.isInteger(videoId) || videoId <= 0) {
      res.status(400).json({ error: "Nieprawidłowe videoId" });
      return;
    }

    const [row] = await db
      .select({
        id: videos.id,
        title: videos.title,
        bunnyVideoId: videos.bunnyVideoId,
        videoUrl: videos.videoUrl,
        durationSeconds: videos.durationSeconds,
        topicId: videos.topicId,
        topicTitle: topics.title,
        sectionTitle: sections.title,
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

    const health =
      isBunnyConfigured() && row.bunnyVideoId
        ? await probeBunnyVideo(row.bunnyVideoId)
        : null;

    res.json({
      id: row.id,
      title: row.title,
      topicId: row.topicId,
      topicTitle: row.topicTitle,
      sectionTitle: row.sectionTitle,
      bunnyVideoId: row.bunnyVideoId,
      embedUrl: buildVideoEmbedUrl(row),
      durationSeconds: row.durationSeconds,
      health,
    });
  } catch (err) {
    req.log.error({ err }, "Video health detail error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Publish status toggles ────────────────────────────────────────────────────

router.patch("/admin/courses/:id/status", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = parseStatus(req.body?.status);
    if (!status) { res.status(400).json({ error: "Nieprawidłowy status" }); return; }
    const [updated] = await db
      .update(courses)
      .set({ status, isPublished: status === "published", updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Kurs nie znaleziony" }); return; }
    await logAdminAction(req.user!.id, "status", "course", id, { status });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Course status error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.patch("/admin/sections/:id/status", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = parseStatus(req.body?.status);
    if (!status) { res.status(400).json({ error: "Nieprawidłowy status" }); return; }
    const [updated] = await db
      .update(sections)
      .set({ status, updatedAt: new Date() })
      .where(eq(sections.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Dział nie znaleziony" }); return; }
    await logAdminAction(req.user!.id, "status", "section", id, { status });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Section status error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.patch("/admin/topics/:id/status", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = parseStatus(req.body?.status);
    if (!status) { res.status(400).json({ error: "Nieprawidłowy status" }); return; }
    const [updated] = await db
      .update(topics)
      .set({ status, updatedAt: new Date() })
      .where(eq(topics.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Temat nie znaleziony" }); return; }
    await logAdminAction(req.user!.id, "status", "topic", id, { status });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Topic status error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.patch("/admin/quizzes/:id/status", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = parseStatus(req.body?.status);
    if (!status) { res.status(400).json({ error: "Nieprawidłowy status" }); return; }
    if (status === "published") {
      const blocker = await quizPublishBlocker(id);
      if (blocker) { res.status(400).json({ error: blocker }); return; }
    }
    const [updated] = await db
      .update(quizzes)
      .set({ status, updatedAt: new Date() })
      .where(eq(quizzes.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Quiz nie znaleziony" }); return; }
    await logAdminAction(req.user!.id, "status", "quiz", id, { status });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Quiz status error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Landing page CMS ──────────────────────────────────────────────────────────

router.get("/admin/landing", async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(landingSections)
      .orderBy(asc(landingSections.sortOrder), asc(landingSections.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Admin list landing error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/landing/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { title, content, isEnabled, sortOrder } = req.body;
    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) setValues.title = String(title);
    if (content !== undefined) setValues.content = content;
    if (isEnabled !== undefined) setValues.isEnabled = Boolean(isEnabled);
    if (sortOrder !== undefined) setValues.sortOrder = Number(sortOrder);
    const [updated] = await db
      .update(landingSections)
      .set(setValues)
      .where(eq(landingSections.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Sekcja nie znaleziona" }); return; }
    await logAdminAction(req.user!.id, "update", "landing_section", id, { key: updated.key });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update landing error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.patch("/admin/landing/:id/toggle", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select()
      .from(landingSections)
      .where(eq(landingSections.id, id))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Sekcja nie znaleziona" }); return; }
    const isEnabled =
      req.body?.isEnabled !== undefined ? Boolean(req.body.isEnabled) : !row.isEnabled;
    const [updated] = await db
      .update(landingSections)
      .set({ isEnabled, updatedAt: new Date() })
      .where(eq(landingSections.id, id))
      .returning();
    await logAdminAction(req.user!.id, "toggle", "landing_section", id, { isEnabled });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Toggle landing error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/landing/reorder", async (req: AuthRequest, res) => {
  try {
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
    if (ids.length === 0) { res.status(400).json({ error: "Brak kolejności" }); return; }
    await Promise.all(
      ids.map((id, index) =>
        db
          .update(landingSections)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(eq(landingSections.id, id)),
      ),
    );
    await logAdminAction(req.user!.id, "reorder", "landing_section", undefined, { ids });
    res.json({ message: "Kolejność zapisana" });
  } catch (err) {
    req.log.error({ err }, "Reorder landing error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── FAQ CMS ───────────────────────────────────────────────────────────────────

router.get("/admin/faq", async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(faqItems)
      .orderBy(asc(faqItems.sortOrder), asc(faqItems.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Admin list FAQ error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/faq", async (req: AuthRequest, res) => {
  try {
    const { question, answer, sortOrder, isVisible } = req.body;
    if (!question || !answer) {
      res.status(400).json({ error: "Pytanie i odpowiedź są wymagane" });
      return;
    }
    const [row] = await db
      .insert(faqItems)
      .values({
        question: String(question),
        answer: String(answer),
        sortOrder: sortOrder != null ? Number(sortOrder) : 0,
        isVisible: isVisible != null ? Boolean(isVisible) : true,
      })
      .returning();
    await logAdminAction(req.user!.id, "create", "faq_item", row.id);
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create FAQ error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/faq/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { question, answer, sortOrder, isVisible } = req.body;
    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (question !== undefined) setValues.question = String(question);
    if (answer !== undefined) setValues.answer = String(answer);
    if (sortOrder !== undefined) setValues.sortOrder = Number(sortOrder);
    if (isVisible !== undefined) setValues.isVisible = Boolean(isVisible);
    const [updated] = await db
      .update(faqItems)
      .set(setValues)
      .where(eq(faqItems.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Pytanie nie znalezione" }); return; }
    await logAdminAction(req.user!.id, "update", "faq_item", id);
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update FAQ error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.patch("/admin/faq/:id/toggle", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(faqItems).where(eq(faqItems.id, id)).limit(1);
    if (!row) { res.status(404).json({ error: "Pytanie nie znalezione" }); return; }
    const isVisible =
      req.body?.isVisible !== undefined ? Boolean(req.body.isVisible) : !row.isVisible;
    const [updated] = await db
      .update(faqItems)
      .set({ isVisible, updatedAt: new Date() })
      .where(eq(faqItems.id, id))
      .returning();
    await logAdminAction(req.user!.id, "toggle", "faq_item", id, { isVisible });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Toggle FAQ error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/faq/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(faqItems).where(eq(faqItems.id, id));
    await logAdminAction(req.user!.id, "delete", "faq_item", id);
    res.json({ message: "Pytanie usunięte" });
  } catch (err) {
    req.log.error({ err }, "Delete FAQ error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/faq/reorder", async (req: AuthRequest, res) => {
  try {
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
    if (ids.length === 0) { res.status(400).json({ error: "Brak kolejności" }); return; }
    await Promise.all(
      ids.map((id, index) =>
        db
          .update(faqItems)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(eq(faqItems.id, id)),
      ),
    );
    await logAdminAction(req.user!.id, "reorder", "faq_item", undefined, { ids });
    res.json({ message: "Kolejność zapisana" });
  } catch (err) {
    req.log.error({ err }, "Reorder FAQ error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── SEO settings ──────────────────────────────────────────────────────────────

router.get("/admin/seo", async (req: AuthRequest, res) => {
  try {
    const seo = await getSeoSettings();
    res.json(seo);
  } catch (err) {
    req.log.error({ err }, "Admin get SEO error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/seo", async (req: AuthRequest, res) => {
  try {
    const { metaTitle, metaDescription, ogTitle, ogDescription, ogImage, canonicalUrl, robots } =
      req.body;
    const clamp = (v: unknown, max: number) => (v === null || v === undefined ? "" : String(v).slice(0, max));
    const values = {
      metaTitle: clamp(metaTitle, 300),
      metaDescription: clamp(metaDescription, 600),
      ogTitle: clamp(ogTitle, 300),
      ogDescription: clamp(ogDescription, 600),
      ogImage: clamp(ogImage, 1000),
      canonicalUrl: clamp(canonicalUrl, 1000),
      robots: robots ? String(robots).slice(0, 100) : "index, follow",
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(seoSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: seoSettings.id, set: values })
      .returning();
    await logAdminAction(req.user!.id, "update", "seo_settings", 1);
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update SEO error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Pricing settings ──────────────────────────────────────────────────────────

router.get("/admin/pricing", async (req: AuthRequest, res) => {
  try {
    const pricing = await getPricingSettings();
    res.json(pricing);
  } catch (err) {
    req.log.error({ err }, "Admin get pricing error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/pricing", async (req: AuthRequest, res) => {
  try {
    const {
      priceGrosz,
      oldPriceGrosz,
      currency,
      promoEnabled,
      promoLabel,
      promoStartsAt,
      promoEndsAt,
      ctaText,
    } = req.body;

    const price = Number(priceGrosz);
    if (!Number.isInteger(price) || price <= 0) {
      res.status(400).json({ error: "Cena musi być liczbą całkowitą większą od zera (w groszach)" });
      return;
    }
    // "Price before promo" is optional: when omitted it equals the current
    // price (no strikethrough). The column is NOT NULL, so we never store null.
    let oldPrice = price;
    if (oldPriceGrosz !== undefined && oldPriceGrosz !== null && oldPriceGrosz !== "") {
      oldPrice = Number(oldPriceGrosz);
      if (!Number.isInteger(oldPrice) || oldPrice < price) {
        res.status(400).json({ error: "Cena przed promocją musi być liczbą całkowitą nie mniejszą niż cena aktualna" });
        return;
      }
    }
    const cur = currency ? String(currency).toUpperCase().slice(0, 3) : "PLN";

    const parseDate = (v: unknown): Date | null => {
      if (v === undefined || v === null || v === "") return null;
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const values = {
      priceGrosz: price,
      oldPriceGrosz: oldPrice,
      currency: cur,
      promoEnabled: promoEnabled != null ? Boolean(promoEnabled) : false,
      promoLabel: promoLabel != null ? String(promoLabel).slice(0, 200) : "",
      promoStartsAt: parseDate(promoStartsAt),
      promoEndsAt: parseDate(promoEndsAt),
      ctaText: ctaText != null ? String(ctaText).slice(0, 200) : "",
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(pricingSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: pricingSettings.id, set: values })
      .returning();
    await logAdminAction(req.user!.id, "update", "pricing_settings", 1, {
      priceGrosz: price,
      currency: cur,
    });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update pricing error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ─── LESSON OPERATIONS: duplicate / reorder / preview ─────────────────────────

// Deep-clone a lesson within its section: the topic row plus its video, quiz
// (with questions + answers), tasks and images. The clone is forced to draft so
// a half-built copy never leaks to students.
router.post("/admin/topics/:id/duplicate", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [src] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
    if (!src) { res.status(404).json({ error: "Temat nie znaleziony" }); return; }

    const clone = await db.transaction(async (tx) => {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = src;
      const [newTopic] = await tx
        .insert(topics)
        .values({
          ...rest,
          title: `${src.title} (kopia)`,
          slug: `${src.slug}-kopia-${Date.now().toString(36)}`,
          status: "draft",
          sortOrder: src.sortOrder + 1,
        })
        .returning();

      const [srcVideo] = await tx.select().from(videos).where(eq(videos.topicId, id)).limit(1);
      if (srcVideo) {
        const { id: _vid, createdAt, updatedAt, topicId, ...vrest } = srcVideo;
        await tx.insert(videos).values({ ...vrest, topicId: newTopic.id });
      }

      const srcImages = await tx.select().from(lessonImages).where(eq(lessonImages.topicId, id));
      for (const img of srcImages) {
        const { id: _iid, createdAt, updatedAt, topicId, ...irest } = img;
        await tx.insert(lessonImages).values({ ...irest, topicId: newTopic.id });
      }

      const srcTasks = await tx.select().from(tasks).where(eq(tasks.topicId, id));
      for (const tk of srcTasks) {
        const { id: _tid, createdAt, updatedAt, topicId, ...trest } = tk;
        await tx.insert(tasks).values({ ...trest, topicId: newTopic.id });
      }

      const [srcQuiz] = await tx.select().from(quizzes).where(eq(quizzes.topicId, id)).limit(1);
      if (srcQuiz) {
        const { id: _qid, createdAt, updatedAt, topicId, ...qrest } = srcQuiz;
        const [newQuiz] = await tx
          .insert(quizzes)
          .values({ ...qrest, topicId: newTopic.id, status: "draft" })
          .returning();
        const srcQuestions = await tx.select().from(quizQuestions).where(eq(quizQuestions.quizId, srcQuiz.id));
        for (const q of srcQuestions) {
          const { id: _qqid, createdAt: qc, updatedAt: qu, quizId, ...qqrest } = q;
          const [newQ] = await tx
            .insert(quizQuestions)
            .values({ ...qqrest, quizId: newQuiz.id })
            .returning();
          const srcAnswers = await tx.select().from(quizAnswers).where(eq(quizAnswers.questionId, q.id));
          for (const a of srcAnswers) {
            const { id: _aid, createdAt: ac, updatedAt: au, questionId, ...arest } = a;
            await tx.insert(quizAnswers).values({ ...arest, questionId: newQ.id });
          }
        }
      }

      return newTopic;
    });

    await logAdminAction(req.user!.id, "duplicate", "topic", clone.id, { sourceId: id });
    res.status(201).json(clone);
  } catch (err) {
    req.log.error({ err }, "Duplicate topic error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/topics/reorder", async (req: AuthRequest, res) => {
  try {
    const { sectionId, ids } = req.body ?? {};
    if (!Number.isInteger(Number(sectionId))) {
      res.status(400).json({ error: "sectionId jest wymagane" });
      return;
    }
    const result = await applyReorder(topics, ids);
    if (!result.ok) { res.status(400).json({ error: "Nieprawidłowa lista ids" }); return; }
    await logAdminAction(req.user!.id, "reorder", "topic", Number(sectionId));
    res.json({ message: "Kolejność zaktualizowana" });
  } catch (err) {
    req.log.error({ err }, "Reorder topics error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Student-style preview of a lesson regardless of publish status, so an admin
// can see exactly what a learner would (video embed, materials, quiz, tasks)
// before publishing. Mirrors the public TopicDetail shape.
router.get("/admin/topics/:id/preview", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [topic] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
    if (!topic) { res.status(404).json({ error: "Temat nie znaleziony" }); return; }

    const [video] = await db.select().from(videos).where(eq(videos.topicId, id)).limit(1);
    const images = await db.select().from(lessonImages).where(eq(lessonImages.topicId, id)).orderBy(asc(lessonImages.sortOrder));
    const taskList = await db.select().from(tasks).where(eq(tasks.topicId, id));
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.topicId, id)).limit(1);

    let quizDetail: any = null;
    if (quiz) {
      const qqs = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(asc(quizQuestions.sortOrder));
      const questions = await Promise.all(
        qqs.map(async (q) => {
          const answers = await db
            .select({
              id: quizAnswers.id,
              questionId: quizAnswers.questionId,
              answerLabel: quizAnswers.answerLabel,
              answerText: quizAnswers.answerText,
            })
            .from(quizAnswers)
            .where(eq(quizAnswers.questionId, q.id))
            .orderBy(asc(quizAnswers.sortOrder), asc(quizAnswers.answerLabel));
          return { ...q, answers };
        }),
      );
      quizDetail = { ...quiz, questions };
    }

    res.json({
      ...topic,
      video: video ? { ...video, embedUrl: buildVideoEmbedUrl(video) } : null,
      images,
      tasks: taskList,
      quiz: quizDetail,
      hasAccess: true,
      preview: true,
    });
  } catch (err) {
    req.log.error({ err }, "Preview topic error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Set/replace a lesson's main thumbnail image.
router.put("/admin/topics/:id/thumbnail", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const thumbnailUrl = typeof req.body?.thumbnailUrl === "string" ? req.body.thumbnailUrl : null;
    const [updated] = await db
      .update(topics)
      .set({ thumbnailUrl, updatedAt: new Date() })
      .where(eq(topics.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Temat nie znaleziony" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Set thumbnail error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ─── QUIZ OPERATIONS: duplicate / reorder ─────────────────────────────────────

router.post("/admin/quizzes/:id/duplicate", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [src] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
    if (!src) { res.status(404).json({ error: "Quiz nie znaleziony" }); return; }

    const clone = await db.transaction(async (tx) => {
      const { id: _id, createdAt, updatedAt, ...rest } = src;
      const [newQuiz] = await tx
        .insert(quizzes)
        .values({ ...rest, title: `${src.title} (kopia)`, status: "draft" })
        .returning();
      const srcQuestions = await tx.select().from(quizQuestions).where(eq(quizQuestions.quizId, id));
      for (const q of srcQuestions) {
        const { id: _qid, createdAt: qc, updatedAt: qu, quizId, ...qrest } = q;
        const [newQ] = await tx.insert(quizQuestions).values({ ...qrest, quizId: newQuiz.id }).returning();
        const srcAnswers = await tx.select().from(quizAnswers).where(eq(quizAnswers.questionId, q.id));
        for (const a of srcAnswers) {
          const { id: _aid, createdAt: ac, updatedAt: au, questionId, ...arest } = a;
          await tx.insert(quizAnswers).values({ ...arest, questionId: newQ.id });
        }
      }
      return newQuiz;
    });

    await logAdminAction(req.user!.id, "duplicate", "quiz", clone.id, { sourceId: id });
    res.status(201).json(clone);
  } catch (err) {
    req.log.error({ err }, "Duplicate quiz error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/quizzes/:id/questions/reorder", async (req: AuthRequest, res) => {
  try {
    const result = await applyReorder(quizQuestions, req.body?.ids, {
      column: quizQuestions.quizId,
      value: Number(req.params.id),
    });
    if (!result.ok) { res.status(400).json({ error: "Nieprawidłowa lista ids" }); return; }
    res.json({ message: "Kolejność zaktualizowana" });
  } catch (err) {
    req.log.error({ err }, "Reorder questions error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/questions/:questionId/duplicate", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.questionId);
    const [src] = await db.select().from(quizQuestions).where(eq(quizQuestions.id, id)).limit(1);
    if (!src) { res.status(404).json({ error: "Pytanie nie znalezione" }); return; }
    const clone = await db.transaction(async (tx) => {
      const { id: _id, createdAt, updatedAt, ...rest } = src;
      const [newQ] = await tx
        .insert(quizQuestions)
        .values({ ...rest, questionText: `${src.questionText} (kopia)`, sortOrder: src.sortOrder + 1 })
        .returning();
      const srcAnswers = await tx.select().from(quizAnswers).where(eq(quizAnswers.questionId, id));
      for (const a of srcAnswers) {
        const { id: _aid, createdAt: ac, updatedAt: au, questionId, ...arest } = a;
        await tx.insert(quizAnswers).values({ ...arest, questionId: newQ.id });
      }
      return newQ;
    });
    res.status(201).json(clone);
  } catch (err) {
    req.log.error({ err }, "Duplicate question error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/questions/:questionId/answers/reorder", async (req: AuthRequest, res) => {
  try {
    const result = await applyReorder(quizAnswers, req.body?.ids, {
      column: quizAnswers.questionId,
      value: Number(req.params.questionId),
    });
    if (!result.ok) { res.status(400).json({ error: "Nieprawidłowa lista ids" }); return; }
    res.json({ message: "Kolejność zaktualizowana" });
  } catch (err) {
    req.log.error({ err }, "Reorder answers error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ─── LESSON IMAGES / MATERIALS ────────────────────────────────────────────────

// Cap an inline data-URL image so the DB does not balloon. Real CDN/URL refs
// are unaffected (they are short). ~3 MB decoded ⇒ ~4 MB base64.
const MAX_IMAGE_URL_LEN = 4 * 1024 * 1024;

router.get("/admin/topics/:id/images", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(lessonImages)
      .where(eq(lessonImages.topicId, id))
      .orderBy(asc(lessonImages.sortOrder));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List lesson images error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/images", async (req: AuthRequest, res) => {
  try {
    const { topicId, imageUrl, alt, sortOrder } = req.body ?? {};
    if (!Number.isInteger(Number(topicId))) {
      res.status(400).json({ error: "topicId jest wymagane" });
      return;
    }
    if (typeof imageUrl !== "string" || imageUrl.trim() === "") {
      res.status(400).json({ error: "imageUrl jest wymagane" });
      return;
    }
    if (imageUrl.length > MAX_IMAGE_URL_LEN) {
      res.status(413).json({ error: "Obraz jest zbyt duży (maks. ~3 MB)" });
      return;
    }
    const [created] = await db
      .insert(lessonImages)
      .values({
        topicId: Number(topicId),
        imageUrl: imageUrl.trim(),
        alt: typeof alt === "string" ? alt : null,
        sortOrder: Number.isInteger(Number(sortOrder)) ? Number(sortOrder) : 0,
      })
      .returning();
    await logAdminAction(req.user!.id, "create", "lesson_image", created.id, { topicId: Number(topicId) });
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Create lesson image error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/images/reorder", async (req: AuthRequest, res) => {
  try {
    const topicId = req.body?.topicId;
    const result = await applyReorder(
      lessonImages,
      req.body?.ids,
      Number.isInteger(Number(topicId))
        ? { column: lessonImages.topicId, value: Number(topicId) }
        : undefined,
    );
    if (!result.ok) { res.status(400).json({ error: "Nieprawidłowa lista ids" }); return; }
    res.json({ message: "Kolejność zaktualizowana" });
  } catch (err) {
    req.log.error({ err }, "Reorder images error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/images/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if ("imageUrl" in req.body) {
      if (typeof req.body.imageUrl !== "string" || req.body.imageUrl.trim() === "") {
        res.status(400).json({ error: "imageUrl nie może być puste" });
        return;
      }
      if (req.body.imageUrl.length > MAX_IMAGE_URL_LEN) {
        res.status(413).json({ error: "Obraz jest zbyt duży (maks. ~3 MB)" });
        return;
      }
      set.imageUrl = req.body.imageUrl.trim();
    }
    if ("alt" in req.body) set.alt = typeof req.body.alt === "string" ? req.body.alt : null;
    if ("sortOrder" in req.body && Number.isInteger(Number(req.body.sortOrder))) {
      set.sortOrder = Number(req.body.sortOrder);
    }
    const [updated] = await db.update(lessonImages).set(set).where(eq(lessonImages.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Obraz nie znaleziony" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update lesson image error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/images/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(lessonImages).where(eq(lessonImages.id, id));
    await logAdminAction(req.user!.id, "delete", "lesson_image", id);
    res.json({ message: "Obraz usunięty" });
  } catch (err) {
    req.log.error({ err }, "Delete lesson image error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ─── BUNNY VIDEO MODULE ───────────────────────────────────────────────────────

// List every video in the Bunny library, annotated with which lesson (if any)
// it is already assigned to so the admin can spot unused/orphaned videos.
router.get("/admin/bunny/library", async (req: AuthRequest, res) => {
  try {
    if (!isBunnyConfigured()) {
      res.json({ configured: false, items: [] });
      return;
    }
    const result = await listBunnyLibrary();
    if (!result.ok) {
      res.json({ configured: true, items: [] });
      return;
    }
    const assignedRows = await db
      .select({ guid: videos.bunnyVideoId, topicId: videos.topicId, topicTitle: topics.title })
      .from(videos)
      .innerJoin(topics, eq(videos.topicId, topics.id));
    const assignedByGuid = new Map(
      assignedRows.filter((r) => r.guid).map((r) => [r.guid as string, r]),
    );
    const items = result.items.map((v) => {
      const a = assignedByGuid.get(v.guid);
      return {
        ...v,
        assignedTopicId: a?.topicId ?? null,
        assignedTopicTitle: a?.topicTitle ?? null,
      };
    });
    res.json({ configured: true, items });
  } catch (err) {
    req.log.error({ err }, "Bunny library error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Cross-reference the Bunny library with the catalogue: videos present in Bunny
// but not assigned to any lesson (orphans), and lessons that have no video yet.
router.get("/admin/bunny/diagnostics", async (req: AuthRequest, res) => {
  try {
    const lessonsWithoutVideoRows = await db
      .select({ topicId: topics.id, topicTitle: topics.title, sectionTitle: sections.title })
      .from(topics)
      .innerJoin(sections, eq(topics.sectionId, sections.id))
      .leftJoin(videos, eq(videos.topicId, topics.id))
      .where(sql`${videos.id} IS NULL`)
      .orderBy(asc(sections.sortOrder), asc(topics.sortOrder));

    if (!isBunnyConfigured()) {
      res.json({
        configured: false,
        orphanVideos: [],
        lessonsWithoutVideo: lessonsWithoutVideoRows,
      });
      return;
    }

    const library = await listBunnyLibrary();
    let orphanVideos: any[] = [];
    if (library.ok) {
      const assigned = await db
        .select({ guid: videos.bunnyVideoId })
        .from(videos)
        .where(sql`${videos.bunnyVideoId} IS NOT NULL`);
      const assignedSet = new Set(assigned.map((a) => a.guid as string));
      orphanVideos = library.items.filter((v) => !assignedSet.has(v.guid));
    }

    res.json({
      configured: true,
      orphanVideos,
      lessonsWithoutVideo: lessonsWithoutVideoRows,
    });
  } catch (err) {
    req.log.error({ err }, "Bunny diagnostics error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Assign a Bunny video to a lesson from a raw GUID, embed URL, or iframe snippet.
// Replaces any existing video on that lesson (one video per lesson).
router.post("/admin/bunny/assign", async (req: AuthRequest, res) => {
  try {
    const { topicId, source, title } = req.body ?? {};
    if (!Number.isInteger(Number(topicId))) {
      res.status(400).json({ error: "topicId jest wymagane" });
      return;
    }
    if (typeof source !== "string" || source.trim() === "") {
      res.status(400).json({ error: "source jest wymagane" });
      return;
    }
    const guid = extractBunnyGuid(source);
    if (!guid) {
      res.status(400).json({ error: "Nie rozpoznano identyfikatora wideo Bunny (GUID)" });
      return;
    }
    const [topic] = await db.select({ id: topics.id, title: topics.title }).from(topics).where(eq(topics.id, Number(topicId))).limit(1);
    if (!topic) { res.status(404).json({ error: "Temat nie znaleziony" }); return; }

    // Pull live metadata when Bunny is reachable so title/duration are accurate.
    let resolvedTitle = typeof title === "string" && title.trim() ? title.trim() : topic.title;
    let durationSeconds: number | null = null;
    if (isBunnyConfigured()) {
      const health = await probeBunnyVideo(guid);
      if (health.ok) {
        if (health.title) resolvedTitle = (typeof title === "string" && title.trim()) ? title.trim() : health.title;
        durationSeconds = health.lengthSeconds;
      }
    }

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(videos).where(eq(videos.topicId, Number(topicId))).limit(1);
      if (existing) {
        const [updated] = await tx
          .update(videos)
          .set({ bunnyVideoId: guid, title: resolvedTitle, durationSeconds, videoUrl: null, updatedAt: new Date() })
          .where(eq(videos.id, existing.id))
          .returning();
        return updated;
      }
      const [created] = await tx
        .insert(videos)
        .values({ topicId: Number(topicId), bunnyVideoId: guid, title: resolvedTitle, durationSeconds })
        .returning();
      return created;
    });

    await logAdminAction(req.user!.id, "assign", "video", result.id, { topicId: Number(topicId), guid });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Bunny assign error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Refresh stored title/duration for every assigned Bunny video from the live
// library. Returns how many rows were updated.
router.post("/admin/bunny/sync", async (req: AuthRequest, res) => {
  try {
    if (!isBunnyConfigured()) {
      res.json({ updated: 0 });
      return;
    }
    const library = await listBunnyLibrary();
    if (!library.ok) {
      res.json({ updated: 0 });
      return;
    }
    const byGuid = new Map(library.items.map((v) => [v.guid, v]));
    const rows = await db
      .select()
      .from(videos)
      .where(sql`${videos.bunnyVideoId} IS NOT NULL`);
    let updated = 0;
    for (const row of rows) {
      const live = byGuid.get(row.bunnyVideoId as string);
      if (!live) continue;
      await db
        .update(videos)
        .set({
          title: live.title || row.title,
          durationSeconds: live.lengthSeconds ?? row.durationSeconds,
          updatedAt: new Date(),
        })
        .where(eq(videos.id, row.id));
      updated++;
    }
    await logAdminAction(req.user!.id, "sync", "video", undefined, { updated });
    res.json({ updated });
  } catch (err) {
    req.log.error({ err }, "Bunny sync error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ─── AI / GEMINI SETTINGS ─────────────────────────────────────────────────────

// Returns the editable AI configuration. The Gemini API key is NEVER included;
// `keyConfigured` only signals presence so the admin UI can show status. The
// `envModel` is the default model when no override is set.
router.get("/admin/ai-settings", async (req: AuthRequest, res) => {
  try {
    const s = await getAiSettings();
    res.json({
      ...s,
      keyConfigured: isGeminiConfigured(),
      envModel: config.gemini.model,
    });
  } catch (err) {
    req.log.error({ err }, "Get AI settings error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/ai-settings", async (req: AuthRequest, res) => {
  try {
    const b = req.body ?? {};
    const values: Record<string, unknown> = { id: 1, updatedAt: new Date() };
    if ("enabled" in b) values.enabled = Boolean(b.enabled);
    if ("model" in b) values.model = typeof b.model === "string" ? b.model.slice(0, 100) : "";
    if ("systemPrompt" in b) values.systemPrompt = typeof b.systemPrompt === "string" ? b.systemPrompt.slice(0, 5000) : "";
    if ("evalInstruction" in b) values.evalInstruction = typeof b.evalInstruction === "string" ? b.evalInstruction.slice(0, 5000) : "";
    if ("tone" in b) values.tone = typeof b.tone === "string" ? b.tone.slice(0, 200) : "";
    if ("maxResponseLength" in b) values.maxResponseLength = Math.max(0, Math.round(Number(b.maxResponseLength) || 0));
    if ("errorMessage" in b) values.errorMessage = typeof b.errorMessage === "string" ? b.errorMessage.slice(0, 500) : "";

    const { id: _drop, ...setValues } = values;
    const [row] = await db
      .insert(aiSettings)
      .values(values as any)
      .onConflictDoUpdate({ target: aiSettings.id, set: setValues })
      .returning();
    await logAdminAction(req.user!.id, "update", "ai_settings", 1);
    res.json({ ...row, keyConfigured: isGeminiConfigured(), envModel: config.gemini.model });
  } catch (err) {
    req.log.error({ err }, "Update AI settings error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Test the current/draft prompt against Gemini (text-only). Falls back to a demo
// reply when Gemini is not configured so the admin UI is never dead.
router.post("/admin/ai-settings/test", async (req: AuthRequest, res) => {
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt) { res.status(400).json({ error: "prompt jest wymagany" }); return; }
    const systemPrompt = typeof req.body?.systemPrompt === "string" ? req.body.systemPrompt : "";

    const settings = await getAiSettings();
    const model = resolveAiModel(settings);

    if (!isGeminiConfigured()) {
      res.json({
        reply:
          "Tryb demonstracyjny: skonfiguruj GEMINI_API_KEY, aby przetestować prawdziwą odpowiedź AI. To jest przykładowa odpowiedź na Twój prompt.",
        model: "demo",
        demo: true,
      });
      return;
    }

    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(config.gemini.apiKey as string);
      const gModel = genAI.getGenerativeModel({
        model,
        ...(systemPrompt.trim() ? { systemInstruction: systemPrompt } : {}),
      });
      const result = await gModel.generateContent(prompt);
      res.json({ reply: result.response.text(), model, demo: false });
    } catch (aiErr) {
      req.log.error({ err: aiErr }, "AI test failed");
      res.status(502).json({ error: "Błąd podczas testu AI. Sprawdź konfigurację i spróbuj ponownie." });
    }
  } catch (err) {
    req.log.error({ err }, "AI test error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Discount codes ────────────────────────────────────────────────────────────

// Parse + validate the editable fields shared by create and update. Returns the
// column values to persist, or a Polish error message. `priceGrosz` is the
// current course price used to cap fixed-amount discounts.
function parseDiscountBody(
  body: any,
  priceGrosz: number,
): { values: Record<string, unknown> } | { error: string } {
  const type = body?.type;
  if (!DISCOUNT_TYPES.includes(type as DiscountType)) {
    return { error: "Typ rabatu musi być 'percent' lub 'amount'" };
  }
  const value = Math.round(Number(body?.value));
  if (!Number.isFinite(value) || value <= 0) {
    return { error: "Wartość rabatu musi być liczbą większą od zera" };
  }
  if (type === "percent" && value > 100) {
    return { error: "Rabat procentowy nie może przekraczać 100%" };
  }
  if (type === "amount" && value > priceGrosz) {
    return { error: "Rabat kwotowy nie może przekraczać ceny kursu" };
  }

  const parseDate = (v: unknown): Date | null => {
    if (v === undefined || v === null || v === "") return null;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const parseCap = (v: unknown): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const validFrom = parseDate(body?.validFrom);
  const validTo = parseDate(body?.validTo);
  if (validFrom && validTo && validTo < validFrom) {
    return { error: "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia" };
  }

  return {
    values: {
      type,
      value,
      validFrom,
      validTo,
      maxUses: parseCap(body?.maxUses),
      maxUsesPerUser: parseCap(body?.maxUsesPerUser),
      isActive: body?.isActive != null ? Boolean(body.isActive) : true,
    },
  };
}

router.get("/admin/discounts", async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        id: discountCodes.id,
        code: discountCodes.code,
        type: discountCodes.type,
        value: discountCodes.value,
        courseId: discountCodes.courseId,
        courseTitle: courses.title,
        validFrom: discountCodes.validFrom,
        validTo: discountCodes.validTo,
        maxUses: discountCodes.maxUses,
        maxUsesPerUser: discountCodes.maxUsesPerUser,
        usedCount: discountCodes.usedCount,
        isActive: discountCodes.isActive,
        createdAt: discountCodes.createdAt,
      })
      .from(discountCodes)
      .leftJoin(courses, eq(discountCodes.courseId, courses.id))
      .orderBy(desc(discountCodes.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List discounts error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/admin/discounts/:id/uses", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [code] = await db.select().from(discountCodes).where(eq(discountCodes.id, id)).limit(1);
    if (!code) { res.status(404).json({ error: "Kod rabatowy nie znaleziony" }); return; }
    const uses = await db
      .select({
        id: discountCodeUses.id,
        userId: discountCodeUses.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        paymentId: discountCodeUses.paymentId,
        courseId: discountCodeUses.courseId,
        amountBeforeGrosz: discountCodeUses.amountBeforeGrosz,
        discountGrosz: discountCodeUses.discountGrosz,
        amountAfterGrosz: discountCodeUses.amountAfterGrosz,
        createdAt: discountCodeUses.createdAt,
      })
      .from(discountCodeUses)
      .leftJoin(users, eq(discountCodeUses.userId, users.id))
      .where(eq(discountCodeUses.discountCodeId, id))
      .orderBy(desc(discountCodeUses.createdAt));
    res.json({ code, uses });
  } catch (err) {
    req.log.error({ err }, "Discount uses error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/admin/discounts", async (req: AuthRequest, res) => {
  try {
    const code = normalizeCode(req.body?.code);
    if (!code || code.length < 3) {
      res.status(400).json({ error: "Kod musi mieć co najmniej 3 znaki" });
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      res.status(400).json({ error: "Kod może zawierać tylko litery, cyfry, '-' i '_'" });
      return;
    }

    let courseId: number | null = null;
    if (req.body?.courseId != null && req.body.courseId !== "") {
      courseId = Number(req.body.courseId);
      if (!Number.isInteger(courseId) || courseId <= 0) {
        res.status(400).json({ error: "Nieprawidłowy identyfikator kursu" });
        return;
      }
      const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).limit(1);
      if (!course) { res.status(404).json({ error: "Kurs nie znaleziony" }); return; }
    }

    const { priceGrosz } = await getPricingSettings();
    const parsed = parseDiscountBody(req.body, priceGrosz);
    if ("error" in parsed) { res.status(400).json({ error: parsed.error }); return; }

    const [existing] = await db.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.code, code)).limit(1);
    if (existing) { res.status(409).json({ error: "Kod rabatowy o tej nazwie już istnieje" }); return; }

    const [row] = await db
      .insert(discountCodes)
      .values({ code, courseId, createdByAdminId: req.user!.id, ...(parsed.values as any) })
      .returning();
    await logAdminAction(req.user!.id, "create", "discount_code", row.id, { code });
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create discount error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/discounts/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [code] = await db.select().from(discountCodes).where(eq(discountCodes.id, id)).limit(1);
    if (!code) { res.status(404).json({ error: "Kod rabatowy nie znaleziony" }); return; }

    let courseId: number | null = code.courseId;
    if ("courseId" in (req.body ?? {})) {
      if (req.body.courseId == null || req.body.courseId === "") {
        courseId = null;
      } else {
        courseId = Number(req.body.courseId);
        if (!Number.isInteger(courseId) || courseId <= 0) {
          res.status(400).json({ error: "Nieprawidłowy identyfikator kursu" });
          return;
        }
        const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).limit(1);
        if (!course) { res.status(404).json({ error: "Kurs nie znaleziony" }); return; }
      }
    }

    const { priceGrosz } = await getPricingSettings();
    const parsed = parseDiscountBody(req.body, priceGrosz);
    if ("error" in parsed) { res.status(400).json({ error: parsed.error }); return; }

    const [row] = await db
      .update(discountCodes)
      .set({ courseId, updatedAt: new Date(), ...(parsed.values as any) })
      .where(eq(discountCodes.id, id))
      .returning();
    await logAdminAction(req.user!.id, "update", "discount_code", id, { code: code.code });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update discount error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.patch("/admin/discounts/:id/toggle", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [code] = await db.select().from(discountCodes).where(eq(discountCodes.id, id)).limit(1);
    if (!code) { res.status(404).json({ error: "Kod rabatowy nie znaleziony" }); return; }
    const [row] = await db
      .update(discountCodes)
      .set({ isActive: !code.isActive, updatedAt: new Date() })
      .where(eq(discountCodes.id, id))
      .returning();
    await logAdminAction(req.user!.id, row.isActive ? "enable" : "disable", "discount_code", id, { code: code.code });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Toggle discount error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.delete("/admin/discounts/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [code] = await db.select().from(discountCodes).where(eq(discountCodes.id, id)).limit(1);
    if (!code) { res.status(404).json({ error: "Kod rabatowy nie znaleziony" }); return; }
    if (code.usedCount > 0) {
      res.status(409).json({ error: "Nie można usunąć kodu, który był już użyty. Wyłącz go zamiast usuwać." });
      return;
    }
    await db.delete(discountCodes).where(eq(discountCodes.id, id));
    await logAdminAction(req.user!.id, "delete", "discount_code", id, { code: code.code });
    res.json({ message: "Kod rabatowy usunięty" });
  } catch (err) {
    req.log.error({ err }, "Delete discount error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Access (Dostępy) ──────────────────────────────────────────────────────────

// Dedicated access management: every grant (manual or payment-sourced) joined
// with its user, course and granting admin, with active/inactive filtering.
router.get("/admin/access", async (req: AuthRequest, res) => {
  try {
    const { status, q } = req.query as { status?: string; q?: string };
    const rows = await db
      .select({
        id: accessGrants.id,
        userId: accessGrants.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        courseId: accessGrants.courseId,
        courseTitle: courses.title,
        source: accessGrants.source,
        paymentId: accessGrants.paymentId,
        grantedByAdminId: accessGrants.grantedByAdminId,
        status: accessGrants.status,
        validFrom: accessGrants.validFrom,
        validTo: accessGrants.validTo,
        createdAt: accessGrants.createdAt,
        updatedAt: accessGrants.updatedAt,
      })
      .from(accessGrants)
      .leftJoin(users, eq(accessGrants.userId, users.id))
      .leftJoin(courses, eq(accessGrants.courseId, courses.id))
      .orderBy(desc(accessGrants.createdAt));

    let filtered = rows;
    if (status === "active") filtered = filtered.filter((r) => r.status === "active");
    else if (status === "inactive") filtered = filtered.filter((r) => r.status !== "active");
    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.email ?? "").toLowerCase().includes(needle) ||
          (r.firstName ?? "").toLowerCase().includes(needle) ||
          (r.lastName ?? "").toLowerCase().includes(needle) ||
          (r.courseTitle ?? "").toLowerCase().includes(needle),
      );
    }
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "List access error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// History of access changes, sourced from the admin log (grant/revoke actions).
router.get("/admin/access/history", async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const whereExpr = inArray(adminLogs.action, ["grant_access", "revoke_access"]);
    const [{ total }] = await db.select({ total: count() }).from(adminLogs).where(whereExpr);
    const logs = await db
      .select({
        id: adminLogs.id,
        adminId: adminLogs.adminId,
        adminEmail: users.email,
        adminFirstName: users.firstName,
        action: adminLogs.action,
        entityType: adminLogs.entityType,
        entityId: adminLogs.entityId,
        metadata: adminLogs.metadata,
        createdAt: adminLogs.createdAt,
      })
      .from(adminLogs)
      .leftJoin(users, eq(adminLogs.adminId, users.id))
      .where(whereExpr)
      .orderBy(desc(adminLogs.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
    res.json({ logs, total: Number(total), page, limit });
  } catch (err) {
    req.log.error({ err }, "Access history error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Grant access to a specific user+course with an optional expiry and note. The
// note is recorded in the admin log so the history view can surface it.
router.post("/admin/access", async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.body?.userId);
    const courseId = Number(req.body?.courseId);
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : null;
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(400).json({ error: "Nieprawidłowy identyfikator użytkownika" });
      return;
    }
    if (!Number.isInteger(courseId) || courseId <= 0) {
      res.status(400).json({ error: "Nieprawidłowy identyfikator kursu" });
      return;
    }
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Użytkownik nie znaleziony" }); return; }
    const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course) { res.status(404).json({ error: "Kurs nie znaleziony" }); return; }

    const [existing] = await db
      .select({ id: accessGrants.id })
      .from(accessGrants)
      .where(and(eq(accessGrants.userId, userId), eq(accessGrants.courseId, courseId), eq(accessGrants.status, "active")))
      .limit(1);
    if (existing) { res.status(409).json({ error: "Użytkownik już ma aktywny dostęp do tego kursu" }); return; }

    const validTo = req.body?.validTo ? new Date(req.body.validTo) : null;
    const [grant] = await db
      .insert(accessGrants)
      .values({
        userId,
        courseId,
        source: "admin",
        grantedByAdminId: req.user!.id,
        status: "active",
        validFrom: new Date(),
        validTo: validTo && !Number.isNaN(validTo.getTime()) ? validTo : null,
      })
      .returning();
    await logAdminAction(req.user!.id, "grant_access", "access_grant", grant.id, { userId, courseId, note });
    res.status(201).json(grant);
  } catch (err) {
    req.log.error({ err }, "Grant access (access view) error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Revoke a single grant by id, with an optional note recorded in the log.
router.delete("/admin/access/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : null;
    const [grant] = await db.select().from(accessGrants).where(eq(accessGrants.id, id)).limit(1);
    if (!grant) { res.status(404).json({ error: "Dostęp nie znaleziony" }); return; }
    if (grant.status !== "active") { res.status(400).json({ error: "Dostęp jest już nieaktywny" }); return; }
    const [updated] = await db
      .update(accessGrants)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(accessGrants.id, id))
      .returning();
    await logAdminAction(req.user!.id, "revoke_access", "access_grant", id, {
      userId: grant.userId,
      courseId: grant.courseId,
      note,
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Revoke access (access view) error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Platform settings ─────────────────────────────────────────────────────────

router.get("/admin/settings", async (req: AuthRequest, res) => {
  try {
    const settings = await getPlatformSettings();
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Get platform settings error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Bulk upsert of settings. Only keys present in the catalog are accepted; any
// unknown key is rejected so the endpoint can never write arbitrary rows (and
// SECRETS, which are not in the catalog, can never be stored here).
router.put("/admin/settings", async (req: AuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const entries = Array.isArray(body.settings)
      ? body.settings
      : Object.entries(body).map(([key, value]) => ({ key, value }));

    const toWrite: Array<{ key: string; value: string }> = [];
    for (const entry of entries) {
      const key = entry?.key;
      const def = typeof key === "string" ? getSettingDef(key) : undefined;
      if (!def) { res.status(400).json({ error: `Nieznane ustawienie: ${key}` }); return; }
      const result = validateSetting(def, entry.value);
      if (!result.ok) { res.status(400).json({ error: result.error }); return; }
      toWrite.push({ key: def.key, value: result.stored });
    }

    await db.transaction(async (tx) => {
      for (const w of toWrite) {
        await tx
          .insert(platformSettings)
          .values({ key: w.key, value: w.value })
          .onConflictDoUpdate({ target: platformSettings.key, set: { value: w.value, updatedAt: new Date() } });
      }
    });
    await logAdminAction(req.user!.id, "update", "platform_settings", undefined, {
      keys: toWrite.map((w) => w.key),
    });
    const settings = await getPlatformSettings();
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Update platform settings error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Import / Export ───────────────────────────────────────────────────────────

// Quote a CSV cell per RFC 4180 (double quotes + escape embedded quotes) so
// values containing commas, quotes or newlines stay intact in spreadsheets.
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // Prepend a UTF-8 BOM so Excel renders Polish characters correctly.
  return "\ufeff" + lines.join("\r\n");
}

function sendCsv(res: any, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

// Export every lesson (topic) with its course/section context, as CSV or JSON.
router.get("/admin/export/lessons", async (req: AuthRequest, res) => {
  try {
    const format = (req.query.format as string) === "json" ? "json" : "csv";
    const rows = await db
      .select({
        id: topics.id,
        title: topics.title,
        slug: topics.slug,
        status: topics.status,
        accessType: topics.accessType,
        difficulty: topics.difficulty,
        durationMinutes: topics.durationMinutes,
        sortOrder: topics.sortOrder,
        sectionId: sections.id,
        sectionTitle: sections.title,
        courseId: courses.id,
        courseTitle: courses.title,
        createdAt: topics.createdAt,
      })
      .from(topics)
      .leftJoin(sections, eq(topics.sectionId, sections.id))
      .leftJoin(courses, eq(sections.courseId, courses.id))
      .orderBy(asc(courses.id), asc(sections.sortOrder), asc(topics.sortOrder));

    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename="lekcje.json"`);
      res.json(rows);
      return;
    }
    const csv = toCsv(
      ["id", "tytul", "slug", "status", "typ_dostepu", "trudnosc", "czas_min", "kolejnosc", "dzial_id", "dzial", "kurs_id", "kurs", "utworzono"],
      rows.map((r) => [
        r.id, r.title, r.slug, r.status, r.accessType, r.difficulty ?? "", r.durationMinutes ?? "",
        r.sortOrder, r.sectionId ?? "", r.sectionTitle ?? "", r.courseId ?? "", r.courseTitle ?? "",
        r.createdAt?.toISOString?.() ?? "",
      ]),
    );
    sendCsv(res, "lekcje.csv", csv);
  } catch (err) {
    req.log.error({ err }, "Export lessons error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/admin/export/users", async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isBanned: users.isBanned,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.id));
    const csv = toCsv(
      ["id", "email", "imie", "nazwisko", "rola", "zablokowany", "utworzono"],
      rows.map((r) => [
        r.id, r.email, r.firstName, r.lastName, r.role, r.isBanned ? "tak" : "nie",
        r.createdAt?.toISOString?.() ?? "",
      ]),
    );
    sendCsv(res, "uzytkownicy.csv", csv);
  } catch (err) {
    req.log.error({ err }, "Export users error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/admin/export/payments", async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        email: users.email,
        provider: payments.provider,
        amount: payments.amount,
        discountGrosz: payments.discountGrosz,
        currency: payments.currency,
        status: payments.status,
        courseId: payments.courseId,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .orderBy(desc(payments.createdAt));
    const csv = toCsv(
      ["id", "uzytkownik_id", "email", "operator", "kwota_grosz", "rabat_grosz", "waluta", "status", "kurs_id", "utworzono"],
      rows.map((r) => [
        r.id, r.userId, r.email ?? "", r.provider, r.amount, r.discountGrosz ?? 0, r.currency, r.status,
        r.courseId ?? "", r.createdAt?.toISOString?.() ?? "",
      ]),
    );
    sendCsv(res, "platnosci.csv", csv);
  } catch (err) {
    req.log.error({ err }, "Export payments error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Export a quiz (with questions + answers, including the correct flag) as a
// portable JSON document that the import endpoint below can re-create.
router.get("/admin/quizzes/:id/export", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
    if (!quiz) { res.status(404).json({ error: "Quiz nie znaleziony" }); return; }
    const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, id)).orderBy(asc(quizQuestions.sortOrder));
    const out = {
      version: 1,
      title: quiz.title,
      passThreshold: quiz.passThreshold,
      maxAttempts: quiz.maxAttempts,
      timeLimitMinutes: quiz.timeLimitMinutes,
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleAnswers: quiz.shuffleAnswers,
      showScore: quiz.showScore,
      showCorrectAnswers: quiz.showCorrectAnswers,
      questions: await Promise.all(
        questions.map(async (q) => {
          const answers = await db.select().from(quizAnswers).where(eq(quizAnswers.questionId, q.id)).orderBy(asc(quizAnswers.sortOrder), asc(quizAnswers.answerLabel));
          return {
            questionText: q.questionText,
            explanation: q.explanation,
            points: q.points,
            sortOrder: q.sortOrder,
            answers: answers.map((a) => ({
              answerLabel: a.answerLabel,
              answerText: a.answerText,
              isCorrect: a.isCorrect,
              sortOrder: a.sortOrder,
            })),
          };
        }),
      ),
    };
    res.setHeader("Content-Disposition", `attachment; filename="quiz-${id}.json"`);
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "Export quiz error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Import a quiz JSON (as produced by the export above) into a topic. Creates the
// quiz as a draft so a half-checked import never leaks to students.
router.post("/admin/quizzes/import", async (req: AuthRequest, res) => {
  try {
    const topicId = Number(req.body?.topicId);
    const data = req.body?.quiz;
    if (!Number.isInteger(topicId) || topicId <= 0) {
      res.status(400).json({ error: "Nieprawidłowy identyfikator tematu" });
      return;
    }
    if (!data || typeof data !== "object" || !Array.isArray(data.questions)) {
      res.status(400).json({ error: "Nieprawidłowy format quizu (brak listy pytań)" });
      return;
    }
    const [topic] = await db.select({ id: topics.id }).from(topics).where(eq(topics.id, topicId)).limit(1);
    if (!topic) { res.status(404).json({ error: "Temat nie znaleziony" }); return; }
    const [existingQuiz] = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.topicId, topicId)).limit(1);
    if (existingQuiz) { res.status(409).json({ error: "Temat ma już przypisany quiz" }); return; }

    // Validate every question shape up front so the import is all-or-nothing.
    for (const [i, q] of data.questions.entries()) {
      if (!q || typeof q.questionText !== "string" || !q.questionText.trim()) {
        res.status(400).json({ error: `Pytanie ${i + 1}: brak treści` });
        return;
      }
      if (!Array.isArray(q.answers) || q.answers.length < 2) {
        res.status(400).json({ error: `Pytanie ${i + 1}: wymagane co najmniej dwie odpowiedzi` });
        return;
      }
      const correct = q.answers.filter((a: any) => a?.isCorrect).length;
      if (correct !== 1) {
        res.status(400).json({ error: `Pytanie ${i + 1}: wymagana dokładnie jedna poprawna odpowiedź` });
        return;
      }
    }

    const created = await db.transaction(async (tx) => {
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          topicId,
          title: typeof data.title === "string" && data.title.trim() ? data.title.slice(0, 200) : "Zaimportowany quiz",
          passThreshold: Number.isFinite(Number(data.passThreshold)) ? Math.min(100, Math.max(0, Math.round(Number(data.passThreshold)))) : 80,
          maxAttempts: data.maxAttempts == null ? null : Math.max(1, Math.round(Number(data.maxAttempts))),
          timeLimitMinutes: data.timeLimitMinutes == null ? null : Math.max(1, Math.round(Number(data.timeLimitMinutes))),
          shuffleQuestions: Boolean(data.shuffleQuestions),
          shuffleAnswers: Boolean(data.shuffleAnswers),
          showScore: data.showScore == null ? true : Boolean(data.showScore),
          showCorrectAnswers: data.showCorrectAnswers == null ? true : Boolean(data.showCorrectAnswers),
          status: "draft",
        })
        .returning();

      for (const [qi, q] of (data.questions as any[]).entries()) {
        const [question] = await tx
          .insert(quizQuestions)
          .values({
            quizId: quiz.id,
            questionText: String(q.questionText).slice(0, 2000),
            explanation: q.explanation ? String(q.explanation).slice(0, 2000) : null,
            points: Number.isFinite(Number(q.points)) ? Math.max(1, Math.round(Number(q.points))) : 1,
            sortOrder: Number.isFinite(Number(q.sortOrder)) ? Number(q.sortOrder) : qi,
          })
          .returning();
        const labels = ["A", "B", "C", "D", "E", "F"];
        for (const [ai, a] of (q.answers as any[]).entries()) {
          await tx.insert(quizAnswers).values({
            questionId: question.id,
            answerLabel: typeof a.answerLabel === "string" && a.answerLabel ? String(a.answerLabel).slice(0, 4) : labels[ai] ?? String(ai + 1),
            answerText: String(a.answerText ?? "").slice(0, 1000),
            isCorrect: Boolean(a.isCorrect),
            sortOrder: Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : ai,
          });
        }
      }
      return quiz;
    });

    await logAdminAction(req.user!.id, "import", "quiz", created.id, { topicId, questions: data.questions.length });
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Import quiz error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// ── Pre-publish preview ("jak u ucznia") ──────────────────────────────────────

// Student-shape quiz preview regardless of publish status. Answers omit the
// correct flag (exactly as a student sees them), but the quiz settings and the
// per-question explanation are included so the admin can review the full setup.
router.get("/admin/quizzes/:id/preview", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
    if (!quiz) { res.status(404).json({ error: "Quiz nie znaleziony" }); return; }
    const qqs = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, id)).orderBy(asc(quizQuestions.sortOrder));
    const questions = await Promise.all(
      qqs.map(async (q) => {
        const answers = await db
          .select({
            id: quizAnswers.id,
            questionId: quizAnswers.questionId,
            answerLabel: quizAnswers.answerLabel,
            answerText: quizAnswers.answerText,
          })
          .from(quizAnswers)
          .where(eq(quizAnswers.questionId, q.id))
          .orderBy(asc(quizAnswers.sortOrder), asc(quizAnswers.answerLabel));
        return { id: q.id, questionText: q.questionText, points: q.points, sortOrder: q.sortOrder, answers };
      }),
    );
    res.json({ ...quiz, questions, preview: true });
  } catch (err) {
    req.log.error({ err }, "Preview quiz error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Landing-page + FAQ preview rendering ALL content (including disabled/hidden
// rows) so the owner can review unpublished copy exactly as it would appear.
router.get("/admin/preview/landing", async (req: AuthRequest, res) => {
  try {
    const sectionsRows = await db.select().from(landingSections).orderBy(asc(landingSections.sortOrder), asc(landingSections.id));
    const faq = await db.select().from(faqItems).orderBy(asc(faqItems.sortOrder), asc(faqItems.id));
    const pricing = await getPricingSettings();
    const seo = await getSeoSettings();
    res.json({ sections: sectionsRows, faq, pricing, seo, preview: true });
  } catch (err) {
    req.log.error({ err }, "Preview landing error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Course-card preview "as a student": the course with its sections and lesson
// counts regardless of publish status, with hasAccess forced true.
router.get("/admin/courses/:id/preview", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
    if (!course) { res.status(404).json({ error: "Kurs nie znaleziony" }); return; }
    const sectionRows = await db.select().from(sections).where(eq(sections.courseId, id)).orderBy(asc(sections.sortOrder), asc(sections.id));
    const withTopics = await Promise.all(
      sectionRows.map(async (s) => {
        const topicRows = await db
          .select({ id: topics.id, title: topics.title, slug: topics.slug, status: topics.status, accessType: topics.accessType, sortOrder: topics.sortOrder })
          .from(topics)
          .where(eq(topics.sectionId, s.id))
          .orderBy(asc(topics.sortOrder), asc(topics.id));
        return { ...s, topics: topicRows, topicCount: topicRows.length };
      }),
    );
    res.json({ ...course, sections: withTopics, hasAccess: true, preview: true });
  } catch (err) {
    req.log.error({ err }, "Preview course error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export default router;
