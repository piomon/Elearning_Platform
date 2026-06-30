import { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { config } from "../config/env";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    isBanned: boolean;
  };
}

interface LocalUser {
  id: number;
  email: string;
  role: string;
  isBanned: boolean;
}

const userColumns = {
  id: users.id,
  email: users.email,
  role: users.role,
  isBanned: users.isBanned,
} as const;

function isAdminEmail(email: string): boolean {
  return config.adminEmails.includes(email.toLowerCase());
}

async function findByClerkId(clerkUserId: string): Promise<LocalUser | undefined> {
  const [user] = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return user;
}

// Promote an already-linked user to admin if their email is configured in
// ADMIN_EMAILS. Never auto-downgrades: an admin granted through the admin panel
// keeps the role even when not listed.
async function maybePromote(user: LocalUser): Promise<LocalUser> {
  if (user.role === "admin" || !isAdminEmail(user.email)) {
    return user;
  }
  const [updated] = await db
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning(userColumns);
  return updated ?? user;
}

// Postgres raises SQLSTATE 23505 on any unique-constraint violation. Drizzle
// surfaces the underlying pg error either directly or via `.cause`.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

// Resolves the local user row for a Clerk user id, creating or linking it on
// first sight (JIT provisioning). Linking to an existing local row only happens
// by VERIFIED primary email so a paid/legacy account can never be hijacked via
// an unverified address.
//
// Concurrent first logins race two unique constraints (clerk_user_id AND email).
// The on-conflict suppresses the clerk_user_id collision; any other unique
// violation (e.g. the email index) is caught and treated as "a concurrent
// request won" so we re-resolve the existing row instead of surfacing a 500.
async function syncClerkUser(clerkUserId: string): Promise<LocalUser | null> {
  const existing = await findByClerkId(clerkUserId);
  if (existing) {
    return maybePromote(existing);
  }

  const profile = await clerkClient.users.getUser(clerkUserId);
  const primary = profile.emailAddresses.find(
    (e) => e.id === profile.primaryEmailAddressId,
  );
  if (!primary || primary.verification?.status !== "verified") {
    // Refuse to create/link an account without a verified primary email.
    return null;
  }
  const email = primary.emailAddress.toLowerCase();
  const role = isAdminEmail(email) ? "admin" : "user";
  const firstName = profile.firstName?.trim() || "Użytkownik";
  const lastName = profile.lastName?.trim() || "";
  const now = new Date();

  try {
    // Link an existing local row that shares this verified email but is not yet
    // bound to a Clerk account (legacy users, or paid users created by an admin).
    const [linked] = await db
      .update(users)
      .set({
        clerkUserId,
        ...(role === "admin" ? { role: "admin" as const } : {}),
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(and(eq(users.email, email), isNull(users.clerkUserId)))
      .returning(userColumns);
    if (linked) {
      return linked;
    }

    // No row to link — insert a fresh user. on-conflict guards against a
    // simultaneous first login creating the same clerk_user_id twice.
    const [created] = await db
      .insert(users)
      .values({ clerkUserId, email, firstName, lastName, role })
      .onConflictDoNothing({ target: users.clerkUserId })
      .returning(userColumns);
    if (created) {
      return created;
    }
  } catch (err) {
    // A concurrent request linked/created the row first and tripped a unique
    // constraint other than the suppressed clerk_user_id one (e.g. email). Fall
    // through to re-resolve; rethrow anything that is not a unique violation.
    if (!isUniqueViolation(err)) {
      throw err;
    }
  }

  // A concurrent request won — read the row it created/linked for this Clerk id.
  const winner = await findByClerkId(clerkUserId);
  return winner ? maybePromote(winner) : null;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Brak autoryzacji" });
    return;
  }
  try {
    const user = await syncClerkUser(userId);
    if (!user) {
      res
        .status(403)
        .json({ error: "Zweryfikuj swój adres email, aby kontynuować" });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ error: "Twoje konto zostało zablokowane" });
      return;
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      isBanned: user.isBanned,
    };
    next();
  } catch (err) {
    req.log?.error({ err }, "Clerk auth sync error");
    res.status(401).json({ error: "Nieprawidłowy token" });
  }
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    res.status(401).json({ error: "Brak autoryzacji" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Brak uprawnień administratora" });
    return;
  }
  next();
}
