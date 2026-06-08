import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { config } from "../config/env";

const JWT_SECRET = config.jwtSecret;

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    isBanned: boolean;
  };
}

export function generateToken(user: { id: number; email: string; role: string }) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: "30d",
  });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Brak autoryzacji" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      isBanned: users.isBanned,
    }).from(users).where(eq(users.id, payload.id)).limit(1);

    if (!user) {
      res.status(401).json({ error: "Użytkownik nie istnieje" });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ error: "Twoje konto zostało zablokowane" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Nieprawidłowy token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
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

