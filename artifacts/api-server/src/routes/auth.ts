import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import { users, loginEvents } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken, requireAuth, type AuthRequest } from "../middlewares/auth";
import { authLimiter } from "../middlewares/rate-limit";
import { getActiveAccessGrants } from "../lib/access";

const router = Router();

router.post("/auth/register", authLimiter, async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: "Wszystkie pola są wymagane" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Hasło musi mieć co najmniej 6 znaków" });
      return;
    }

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing) {
      res.status(409).json({ error: "Email jest już zajęty" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users).values({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: "user",
    }).returning({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      isBanned: users.isBanned,
      bannedReason: users.bannedReason,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    });

    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email i hasło są wymagane" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (!user) {
      res.status(401).json({ error: "Nieprawidłowy email lub hasło" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Nieprawidłowy email lub hasło" });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({ error: `Twoje konto zostało zablokowane. Powód: ${user.bannedReason ?? "brak"}` });
      return;
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await db.insert(loginEvents).values({
      userId: user.id,
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });

    const token = generateToken(user);
    const { passwordHash, ...safeUser } = user;
    res.json({ user: { ...safeUser, lastLoginAt: new Date().toISOString() }, token });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/auth/logout", (req, res) => {
  res.json({ message: "Wylogowano pomyślnie" });
});

router.get("/auth/me", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      isBanned: users.isBanned,
      bannedReason: users.bannedReason,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    }).from(users).where(eq(users.id, req.user!.id)).limit(1);

    if (!user) {
      res.status(404).json({ error: "Użytkownik nie znaleziony" });
      return;
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
