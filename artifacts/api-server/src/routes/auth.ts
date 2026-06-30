import { Router } from "express";
import { db } from "@workspace/db";
import { users, loginEvents } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getActiveAccessGrants } from "../lib/access";

const router = Router();

// Record at most one login event per hour per user so repeated /auth/me
// refetches don't flood the login history.
const LOGIN_EVENT_THROTTLE_MS = 60 * 60 * 1000;

// Sign-in and sign-up are handled entirely by Clerk on the client. This stays as
// a harmless success response for any legacy caller; the frontend calls Clerk's
// signOut directly.
router.post("/auth/logout", (_req, res) => {
  res.json({ message: "Wylogowano pomyślnie" });
});

// Clerk-verified profile + access snapshot. requireAuth has already verified the
// Clerk session and JIT-synced (created/linked) the local user row, so req.user
// is guaranteed to be set here.
router.get("/auth/me", requireAuth as never, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const [user] = await db
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
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Użytkownik nie znaleziony" });
      return;
    }

    const now = new Date();
    const [recent] = await db
      .select({ createdAt: loginEvents.createdAt })
      .from(loginEvents)
      .where(eq(loginEvents.userId, userId))
      .orderBy(desc(loginEvents.createdAt))
      .limit(1);
    if (
      !recent ||
      now.getTime() - recent.createdAt.getTime() > LOGIN_EVENT_THROTTLE_MS
    ) {
      await db.insert(loginEvents).values({
        userId,
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });
      await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, userId));
      user.lastLoginAt = now;
    }

    const accessGrants = await getActiveAccessGrants(user.id);

    res.json({
      ...user,
      hasAccess: user.role === "admin" || accessGrants.length > 0,
      accessGrants,
    });
  } catch (err) {
    req.log.error({ err }, "GetMe error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export default router;
