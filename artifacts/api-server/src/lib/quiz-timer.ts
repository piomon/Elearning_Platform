import crypto from "node:crypto";
import { config } from "../config/env";

const TICKET_SECRET = config.sessionSecret;

// A signed "quiz started" ticket. The server issues it when a student begins a
// timed quiz and verifies it on submission, so the elapsed-time check is
// server-authoritative and cannot be forged or back-dated by the client. Signed
// with a local HMAC (not a Clerk credential) so it stays independent of auth.
interface QuizStartClaims {
  quizId: number;
  userId: number;
  // Epoch milliseconds when the attempt window opened.
  startedAt: number;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", TICKET_SECRET)
    .update(payload)
    .digest("base64url");
}

// `startedAt` is injectable so tests can simulate an already-elapsed window.
export function signQuizStart(
  quizId: number,
  userId: number,
  startedAt: number = Date.now(),
): string {
  const claims: QuizStartClaims = { quizId, userId, startedAt };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyQuizStart(token: string): QuizStartClaims | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = sign(payload);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return null;
    }
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<QuizStartClaims>;
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
