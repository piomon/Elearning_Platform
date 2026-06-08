import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { users, loginEvents } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken, requireAuth, type AuthRequest } from "../middlewares/auth";
import { authLimiter } from "../middlewares/rate-limit";
import { getActiveAccessGrants } from "../lib/access";

const router = Router();

const registerSchema = z.object({
  email: z.email("Nieprawidłowy adres email").max(255),
  password: z.string().min(6, "Hasło musi mieć co najmniej 6 znaków").max(128),
  firstName: z.string().trim().min(1, "Imię jest wymagane").max(100),
  lastName: z.string().trim().min(1, "Nazwisko jest wymagane").max(100),
});

const loginSchema = z.object({
  email: z.email("Nieprawidłowy adres email"),
  password: z.string().min(1, "Hasło jest wymagane"),
});

router.post("/auth/register", authLimiter, async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" });
      return;
    }
    const { email, password, firstName, lastName } = parsed.data;

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
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" });
      return;
    }
    const { email, password } = parsed.data;

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
