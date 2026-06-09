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
} from "@workspace/db";
import { eq, ne, and, desc, asc, count, sum, ilike, or, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/auth";
import {
  probeBunnyVideo,
  mapWithConcurrency,
  type BunnyVideoHealth,
} from "../lib/bunny";
import { isBunnyConfigured } from "../config/env";
import { buildVideoEmbedUrl } from "../lib/video";

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

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/admin/dashboard", async (req: AuthRequest, res) => {
  try {
    const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(users);
    const [{ activeAccess }] = await db.select({ activeAccess: count() }).from(accessGrants).where(eq(accessGrants.status, "active"));
    const [{ totalPayments }] = await db.select({ totalPayments: count() }).from(payments);
    const [{ revenue }] = await db
      .select({ revenue: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.status, "completed"));

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

    res.json({
      totalUsers,
      activeAccess,
      totalPayments,
      totalRevenue: Number(revenue ?? 0),
      recentLogins,
      recentMessages,
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
                return { ...t, video: vid ?? null, quiz: quizDetail, tasks: taskList };
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
    const { title, slug, description, isPublished } = req.body;
    const [course] = await db.insert(courses).values({ title, slug, description: description ?? "", isPublished: isPublished ?? false }).returning();
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
    const { title, slug, description, isPublished } = req.body;
    const [updated] = await db.update(courses).set({ title, slug, description, isPublished, updatedAt: new Date() }).where(eq(courses.id, id)).returning();
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
    const { sectionId, title, slug, description, sortOrder } = req.body;
    const [t] = await db.insert(topics).values({ sectionId, title, slug, description, sortOrder: sortOrder ?? 0 }).returning();
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
    const { title, slug, description, sortOrder } = req.body;
    const [updated] = await db.update(topics).set({ title, slug, description, sortOrder, updatedAt: new Date() }).where(eq(topics.id, id)).returning();
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
    const { topicId, title } = req.body;
    const [q] = await db.insert(quizzes).values({ topicId, title }).returning();
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
    const { title } = req.body;
    const [updated] = await db.update(quizzes).set({ title, updatedAt: new Date() }).where(eq(quizzes.id, id)).returning();
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
    const { questionText, sortOrder } = req.body;
    const [q] = await db.insert(quizQuestions).values({ quizId, questionText, sortOrder: sortOrder ?? 0 }).returning();
    res.status(201).json(q);
  } catch (err) {
    req.log.error({ err }, "Create question error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.put("/admin/questions/:questionId", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.questionId);
    const { questionText, sortOrder } = req.body;
    const [updated] = await db.update(quizQuestions).set({ questionText, sortOrder, updatedAt: new Date() }).where(eq(quizQuestions.id, id)).returning();
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
        .values({ questionId, answerLabel, answerText, isCorrect: isCorrect ?? false })
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

export default router;
