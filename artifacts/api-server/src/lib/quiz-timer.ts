import jwt from "jsonwebtoken";
import { config } from "../config/env";

const JWT_SECRET = config.jwtSecret;

// A signed "quiz started" ticket. The server issues it when a student begins a
// timed quiz and verifies it on submission, so the elapsed-time check is
// server-authoritative and cannot be forged or back-dated by the client.
interface QuizStartClaims {
  quizId: number;
  userId: number;
  // Epoch milliseconds when the attempt window opened.
  startedAt: number;
}

// `startedAt` is injectable so tests can simulate an already-elapsed window.
export function signQuizStart(
  quizId: number,
  userId: number,
  startedAt: number = Date.now(),
): string {
  const claims: QuizStartClaims = { quizId, userId, startedAt };
  return jwt.sign(claims, JWT_SECRET);
}

export function verifyQuizStart(token: string): QuizStartClaims | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Partial<QuizStartClaims>;
    if (
      typeof decoded.quizId === "number" &&
      typeof decoded.userId === "number" &&
      typeof decoded.startedAt === "number"
    ) {
      return decoded as QuizStartClaims;
    }
    return null;
  } catch {
    return null;
  }
}

// Returns true when the start ticket is valid for this quiz+user and the
// configured time limit has not yet elapsed. A small grace window absorbs
// network latency between the client clock hitting zero and the request
// arriving. `timeLimitMinutes == null` means unlimited (always allowed).
export function isWithinTimeLimit(
  claims: QuizStartClaims,
  quizId: number,
  userId: number,
  timeLimitMinutes: number | null,
  graceSeconds = 5,
): boolean {
  if (claims.quizId !== quizId || claims.userId !== userId) return false;
  if (timeLimitMinutes == null) return true;
  const elapsedMs = Date.now() - claims.startedAt;
  const allowedMs = timeLimitMinutes * 60_000 + graceSeconds * 1_000;
  return elapsedMs <= allowedMs;
}
