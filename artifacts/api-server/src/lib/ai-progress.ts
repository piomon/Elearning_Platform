// Live progress of an in-flight AI operation, so the frontend can show an
// honest "Usługa AI jest chwilowo przeciążona. Ponawiam próbę 2 z 4…" instead
// of a mute spinner (brief §3). The client sends a random requestId with the
// AI request and polls GET /ai/progress/:requestId while waiting.
//
// In-memory by design: entries live for minutes, are purely cosmetic, and the
// VPS deployment runs a single api-server instance. Losing them on restart is
// harmless (the frontend just shows the default "analizuję…" text).

import type { AiOperation, AiProgressUpdate } from "./gemini";

export type AiProgressPhase = "queued" | "calling" | "retry-scheduled" | "done" | "failed";

export interface AiProgressEntry {
  userId: number;
  operation: AiOperation;
  phase: AiProgressPhase;
  attempt: number;
  maxAttempts: number;
  reason?: string;
  createdAt: number;
  updatedAt: number;
}

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_ENTRIES = 2_000;
const ENTRY_TTL_MS = 10 * 60_000;
const FINISHED_TTL_MS = 2 * 60_000;

const store = new Map<string, AiProgressEntry>();

export function isValidRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_RE.test(value);
}

function sweep(now = Date.now()): void {
  for (const [key, entry] of store) {
    const finished = entry.phase === "done" || entry.phase === "failed";
    if (
      now - entry.createdAt > ENTRY_TTL_MS ||
      (finished && now - entry.updatedAt > FINISHED_TTL_MS)
    ) {
      store.delete(key);
    }
  }
}

// Periodic cleanup; unref() so the timer never keeps the process alive.
const sweeper = setInterval(() => sweep(), 60_000);
sweeper.unref?.();

export function beginAiProgress(
  requestId: string,
  userId: number,
  operation: AiOperation,
  maxAttempts: number,
): void {
  if (store.size >= MAX_ENTRIES) sweep();
  if (store.size >= MAX_ENTRIES) return; // refuse to grow unbounded
  const now = Date.now();
  store.set(requestId, {
    userId,
    operation,
    phase: "queued",
    attempt: 0,
    maxAttempts,
    createdAt: now,
    updatedAt: now,
  });
}

export function updateAiProgress(requestId: string, update: AiProgressUpdate): void {
  const entry = store.get(requestId);
  if (!entry) return;
  entry.phase = update.phase;
  entry.attempt = update.attempt;
  entry.maxAttempts = update.maxAttempts;
  entry.reason = update.reason;
  entry.updatedAt = Date.now();
}

export function finishAiProgress(requestId: string, phase: "done" | "failed"): void {
  const entry = store.get(requestId);
  if (!entry) return;
  entry.phase = phase;
  entry.updatedAt = Date.now();
}

// Owner-only read: a requestId is random, but never leak cross-user progress
// even if one is guessed/shared.
export function readAiProgress(requestId: string, userId: number): AiProgressEntry | null {
  const entry = store.get(requestId);
  if (!entry || entry.userId !== userId) return null;
  return entry;
}

/** Visible for tests. */
export function clearAiProgress(): void {
  store.clear();
}
