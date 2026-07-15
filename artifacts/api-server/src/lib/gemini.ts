// Shared plumbing for ALL Gemini calls: per-attempt timeouts, ONE central
// retry mechanism for transient upstream failures, in-flight deduplication,
// cancellation, and a translator from upstream failures to honest Polish
// user messages. No route implements its own retry loop — they all go
// through callGeminiWithRetry().
//
// Retry policy (brief: "Automatyczne ponawianie zapytań"):
// - Transient failures — 429 / 500 / 502 / 503 / 504, request timeouts and
//   network drops — are retried with exponential backoff plus random jitter
//   (schedule ~1 s → ~2 s → ~4 s), honoring Google's RetryInfo hint (the
//   JSON-API equivalent of a Retry-After header) when one is present.
// - Permanent failures — 400 / 401 / 403 / 404, validation errors — are NOT
//   retried here; retrying them only burns quota. The one exception lives a
//   level up: on 404 (retired/gated model name) routes switch to
//   FALLBACK_AI_MODEL exactly once (see routes/ai.ts).
// - Attempts are capped (default 4 = first call + 3 retries), the whole
//   operation has a total time budget, and an AbortSignal (wired to the HTTP
//   connection) cancels both waits and further attempts.

import { config } from "../config/env";

// Hard per-attempt cap for the slowest (vision) calls: stays under typical
// 60 s proxy limits while leaving room for slow answers.
export const GEMINI_TIMEOUT_MS = 55_000;

export type AiOperation = "check" | "chat" | "admin-test";

export interface AiRetryProfile {
  /** Per-attempt timeout passed to the SDK (may be shortened by the budget). */
  attemptTimeoutMs: number;
  /** Upper bound for the whole operation, retries and waits included. */
  totalBudgetMs: number;
  /** Attempt cap, first call included (4 = 1 call + 3 retries). */
  maxAttempts: number;
  /** Base backoff before retry #2, #3, #4… — jitter is applied on top. */
  baseDelaysMs: number[];
}

// Separate operation profiles (brief: "Rozdzielenie rodzajów zapytań"):
// vision checks get quality/latency headroom, the text assistant is tuned for
// fast cheap replies, the admin test fails fast to show the true state.
export const AI_PROFILES: Record<AiOperation, AiRetryProfile> = {
  check: {
    attemptTimeoutMs: GEMINI_TIMEOUT_MS,
    totalBudgetMs: 115_000,
    maxAttempts: 4,
    baseDelaysMs: [1_000, 2_000, 4_000],
  },
  chat: {
    attemptTimeoutMs: 25_000,
    totalBudgetMs: 65_000,
    maxAttempts: 4,
    baseDelaysMs: [1_000, 2_000, 4_000],
  },
  "admin-test": {
    attemptTimeoutMs: 20_000,
    totalBudgetMs: 30_000,
    maxAttempts: 2,
    baseDelaysMs: [1_000],
  },
};

// ─── Error classification ────────────────────────────────────────────────────

export function getGeminiStatus(err: unknown): number | undefined {
  if (err instanceof AiCallFailure) return getGeminiStatus(err.cause);
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

// True when Gemini rejected the model name itself (retired, gated for new
// users, or misspelled) — the one failure that retrying with a DIFFERENT
// model can fix (and plain retrying cannot).
export function isModelUnavailable(err: unknown): boolean {
  return getGeminiStatus(err) === 404;
}

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

export function isTimeoutError(err: unknown): boolean {
  const cause = err instanceof AiCallFailure ? err.cause : err;
  const message = cause instanceof Error ? `${cause.name} ${cause.message}` : String(cause ?? "");
  return /abort|timeout|timed out|deadline/i.test(message);
}

function isNetworkError(err: unknown): boolean {
  const cause = err instanceof AiCallFailure ? err.cause : err;
  if (getGeminiStatus(cause) !== undefined) return false;
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  return /fetch failed|network|socket hang up|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|EPIPE/i.test(
    message,
  );
}

// Brief §2: retry ONLY transient failures; permanent ones fail immediately.
export function isTransientGeminiError(err: unknown): boolean {
  const status = getGeminiStatus(err);
  if (status !== undefined) return TRANSIENT_STATUSES.has(status);
  return isTimeoutError(err) || isNetworkError(err);
}

// ─── Server-provided retry hints ─────────────────────────────────────────────

// The SDK hides response headers, so a literal Retry-After header is not
// reachable — but Google sends the same information as google.rpc.RetryInfo
// in errorDetails (typical for 429), and embeds the JSON body in the error
// message. Honor whichever is available.
export function getServerRetryDelayMs(err: unknown): number | undefined {
  const cause = err instanceof AiCallFailure ? err.cause : err;
  const details = (cause as { errorDetails?: unknown } | null)?.errorDetails;
  if (Array.isArray(details)) {
    for (const detail of details) {
      if (!detail || typeof detail !== "object") continue;
      const type = String((detail as Record<string, unknown>)["@type"] ?? "");
      if (!type.endsWith("RetryInfo")) continue;
      const parsed = parseRetryDelay((detail as Record<string, unknown>).retryDelay);
      if (parsed !== undefined) return parsed;
    }
  }
  const message = cause instanceof Error ? cause.message : "";
  const match = message.match(/"retryDelay"\s*:\s*"([0-9.]+)s"/);
  if (match) return Math.round(parseFloat(match[1]) * 1000);
  return undefined;
}

function parseRetryDelay(raw: unknown): number | undefined {
  if (typeof raw === "string") {
    const match = raw.match(/^([0-9.]+)s$/);
    if (match) return Math.round(parseFloat(match[1]) * 1000);
    return undefined;
  }
  if (raw && typeof raw === "object") {
    const seconds = Number((raw as Record<string, unknown>).seconds ?? 0);
    const nanos = Number((raw as Record<string, unknown>).nanos ?? 0);
    if (Number.isFinite(seconds) && (seconds > 0 || nanos > 0)) {
      return Math.round(seconds * 1000 + nanos / 1e6);
    }
  }
  return undefined;
}

// A server hint larger than this is treated as "give up now" territory —
// waiting longer than the student would is dishonest UX.
export const MAX_SERVER_RETRY_DELAY_MS = 15_000;

// Pure and exported for tests. `nextAttempt` is 2-based (delay BEFORE that
// attempt). Jitter spreads clients over 0.5×–1.5× of the base so parallel
// failures don't stampede Google in sync; a RetryInfo hint raises (never
// lowers below jitter) the wait, capped at MAX_SERVER_RETRY_DELAY_MS.
export function computeRetryDelayMs(
  nextAttempt: number,
  err: unknown,
  profile: AiRetryProfile,
  random: () => number = Math.random,
): number {
  const index = Math.min(Math.max(nextAttempt - 2, 0), profile.baseDelaysMs.length - 1);
  const base = profile.baseDelaysMs[index] ?? 1_000;
  const jittered = Math.round(base * (0.5 + random()));
  const serverHint = getServerRetryDelayMs(err);
  if (serverHint !== undefined) {
    return Math.min(Math.max(jittered, serverHint), MAX_SERVER_RETRY_DELAY_MS);
  }
  return jittered;
}

// ─── Retry engine ────────────────────────────────────────────────────────────

export interface AiAttemptLog {
  attempt: number;
  ok: boolean;
  httpStatus?: number;
  ms: number;
  reason?: string;
}

export interface AiProgressUpdate {
  attempt: number;
  maxAttempts: number;
  phase: "calling" | "retry-scheduled";
  delayMs?: number;
  reason?: string;
}

export interface AiCallOutcome<T> {
  value: T;
  attempts: number;
  rescuedByRetry: boolean;
  attemptLog: AiAttemptLog[];
  totalMs: number;
  /** True when this outcome was shared from an identical in-flight call —
   * the caller must NOT bill/log it a second time. */
  sharedFromDedupe?: boolean;
}

/** Thrown when the client disconnected / the operation was cancelled. */
export class AiOperationAborted extends Error {
  constructor(message = "Operacja AI przerwana przez klienta") {
    super(message);
    this.name = "AiOperationAborted";
  }
}

/** Final failure after the retry loop. `cause` is the last upstream error;
 * the attempt log lets callers record exactly what happened. */
export class AiCallFailure extends Error {
  /** True when this failure was shared from an identical in-flight call —
   * the accounting owner already logged it; do NOT record usage again. */
  public sharedFromDedupe = false;
  constructor(
    public override readonly cause: unknown,
    public readonly attemptLog: AiAttemptLog[],
    public readonly totalMs: number,
  ) {
    super(cause instanceof Error ? cause.message : String(cause ?? "AI call failed"));
    this.name = "AiCallFailure";
  }
  get attempts(): number {
    return this.attemptLog.length;
  }
}

export interface GeminiCallContext {
  attempt: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface GeminiCallOptions<T> {
  operation: AiOperation;
  /** Test/route-level overrides of the operation profile. */
  profile?: Partial<AiRetryProfile>;
  /** Cancels waits and further attempts (wire to the HTTP connection). */
  signal?: AbortSignal;
  /** Identical concurrent calls (same key) share ONE upstream request. */
  dedupeKey?: string;
  /** Live progress for the UI ("Ponawiam próbę 2 z 4…"). */
  onAttempt?: (update: AiProgressUpdate) => void;
  log?: { warn: (obj: unknown, msg?: string) => void };
  fn: (ctx: GeminiCallContext) => Promise<T>;
}

// Protection against concurrent duplicates (brief §2): repeated identical
// requests (double-click, impatient refresh) join the in-flight upstream call
// instead of multiplying it. Single-process map — matches the single-instance
// VPS deployment.
//
// Subscriber-aware: every caller (creator and joiners) subscribes with its OWN
// AbortSignal. The shared upstream call runs on an internal controller and is
// cancelled only when the LAST subscriber leaves — one client disconnecting
// must not fail the others. Exactly one surviving subscriber receives the
// outcome unmarked (it "owns" usage accounting); everyone else gets
// sharedFromDedupe, on success AND on failure, so one upstream call is never
// billed or logged twice.
interface DedupeSubscriber {
  left: boolean;
  onAttempt?: (update: AiProgressUpdate) => void;
}

interface InFlightEntry {
  promise: Promise<AiCallOutcome<unknown>>;
  internal: AbortController;
  subscribers: DedupeSubscriber[];
  accountingClaimed: boolean;
}

const inFlight = new Map<string, InFlightEntry>();

/** Visible for tests. */
export function inFlightCount(): number {
  return inFlight.size;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AiOperationAborted());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AiOperationAborted());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// Dev-only fault injection: AI_FAKE_TRANSIENT_ERRORS=n makes the first n
// attempts of every call fail with a synthetic 503, so the retry path and the
// frontend "Ponawiam próbę…" status can be demonstrated without waiting for a
// real Google outage. Hard-disabled in production. Read live (not cached in
// config) so toggling only needs a workflow restart.
function syntheticFailuresPerCall(): number {
  if (config.isProd) return 0;
  const raw = Number(process.env.AI_FAKE_TRANSIENT_ERRORS ?? 0);
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 10) : 0;
}

export async function callGeminiWithRetry<T>(
  options: GeminiCallOptions<T>,
): Promise<AiCallOutcome<T>> {
  const key = options.dedupeKey;
  if (!key) return runWithRetry(options);
  if (options.signal?.aborted) throw new AiOperationAborted();

  let entry = inFlight.get(key);
  const isCreator = !entry;
  if (!entry) {
    const fresh: InFlightEntry = {
      internal: new AbortController(),
      subscribers: [],
      accountingClaimed: false,
      promise: undefined as unknown as Promise<AiCallOutcome<unknown>>,
    };
    inFlight.set(key, fresh);
    entry = fresh;
  }

  // Subscribe BEFORE starting the run so even the synchronous attempt-1
  // progress event fans out to this caller.
  const sub: DedupeSubscriber = { left: false, onAttempt: options.onAttempt };
  entry.subscribers.push(sub);

  if (isCreator) {
    const created = entry;
    created.promise = runWithRetry({
      ...options,
      signal: created.internal.signal,
      // Live progress ("Ponawiam próbę…") for every still-connected caller.
      onAttempt: (update) => {
        for (const s of created.subscribers) {
          if (!s.left) s.onAttempt?.(update);
        }
      },
    }).finally(() => {
      inFlight.delete(key);
    }) as Promise<AiCallOutcome<unknown>>;
    // If every subscriber disconnects, the internal abort rejects this promise
    // with nobody awaiting it — swallow to avoid an unhandled rejection.
    created.promise.catch(() => {});
  }

  return awaitShared<T>(entry, sub, options.signal);
}

/** Wait on the shared in-flight call as one of its subscribers. */
async function awaitShared<T>(
  entry: InFlightEntry,
  sub: DedupeSubscriber,
  signal: AbortSignal | undefined,
): Promise<AiCallOutcome<T>> {
  const leave = () => {
    if (sub.left) return;
    sub.left = true;
    // The last active subscriber leaving cancels the shared upstream call.
    if (entry.subscribers.every((s) => s.left)) entry.internal.abort();
  };

  let outcome: AiCallOutcome<unknown>;
  try {
    outcome = await raceWithSignal(entry.promise, signal, leave);
  } catch (err) {
    sub.left = true;
    if (err instanceof AiCallFailure) {
      // Exactly one subscriber reports the shared failure to usage logging.
      if (!entry.accountingClaimed) {
        entry.accountingClaimed = true;
        throw err;
      }
      const shared = new AiCallFailure(err.cause, err.attemptLog, err.totalMs);
      shared.sharedFromDedupe = true;
      throw shared;
    }
    if (err instanceof AiOperationAborted && !signal?.aborted) {
      // The shared call was cancelled by the OTHER subscribers' disconnects in
      // the narrow window around this caller joining — surface it as a
      // transient failure, not as "this client disconnected".
      throw new AiCallFailure(err, [], 0);
    }
    throw err;
  }
  sub.left = true;
  // Exactly one subscriber gets the unmarked outcome and records usage —
  // normally the creator, or the first surviving joiner if the creator left.
  if (!entry.accountingClaimed) {
    entry.accountingClaimed = true;
    return outcome as AiCallOutcome<T>;
  }
  return { ...(outcome as AiCallOutcome<T>), sharedFromDedupe: true };
}

/** Await `promise`, but reject with AiOperationAborted (after running
 * `onOwnAbort`) the moment the caller's own signal fires. */
function raceWithSignal<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  onOwnAbort: () => void,
): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      onOwnAbort();
      reject(new AiOperationAborted());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

async function runWithRetry<T>(options: GeminiCallOptions<T>): Promise<AiCallOutcome<T>> {
  const profile: AiRetryProfile = { ...AI_PROFILES[options.operation], ...options.profile };
  const startedAt = Date.now();
  const attemptLog: AiAttemptLog[] = [];
  const synthetic = syntheticFailuresPerCall();
  let lastError: unknown = new Error("AI call did not run");

  for (let attempt = 1; attempt <= profile.maxAttempts; attempt++) {
    if (options.signal?.aborted) throw new AiOperationAborted();
    options.onAttempt?.({ attempt, maxAttempts: profile.maxAttempts, phase: "calling" });
    const attemptStart = Date.now();
    try {
      if (attempt <= synthetic) {
        const fake = new Error(
          `Synthetic 503 for attempt ${attempt} (AI_FAKE_TRANSIENT_ERRORS — dev only)`,
        ) as Error & { status: number };
        fake.status = 503;
        throw fake;
      }
      const remaining = profile.totalBudgetMs - (Date.now() - startedAt);
      const timeoutMs = Math.max(1_000, Math.min(profile.attemptTimeoutMs, remaining));
      const value = await options.fn({ attempt, timeoutMs, signal: options.signal });
      attemptLog.push({ attempt, ok: true, ms: Date.now() - attemptStart });
      return {
        value,
        attempts: attempt,
        rescuedByRetry: attempt > 1,
        attemptLog,
        totalMs: Date.now() - startedAt,
      };
    } catch (err) {
      if (err instanceof AiOperationAborted) throw err;
      lastError = err;
      const httpStatus = getGeminiStatus(err);
      const reason =
        httpStatus !== undefined
          ? `HTTP ${httpStatus}`
          : isTimeoutError(err)
            ? "timeout"
            : isNetworkError(err)
              ? "network"
              : "error";
      attemptLog.push({
        attempt,
        ok: false,
        httpStatus,
        ms: Date.now() - attemptStart,
        reason,
      });
      if (options.signal?.aborted) throw new AiOperationAborted();
      if (!isTransientGeminiError(err)) break;
      if (attempt >= profile.maxAttempts) break;

      const delayMs = computeRetryDelayMs(attempt + 1, err, profile);
      // Stop early when the remaining budget cannot fit the wait plus a
      // meaningful attempt — an honest error now beats a doomed retry.
      if (Date.now() - startedAt + delayMs + 2_000 > profile.totalBudgetMs) break;
      options.log?.warn(
        {
          operation: options.operation,
          attempt,
          maxAttempts: profile.maxAttempts,
          reason,
          nextDelayMs: delayMs,
        },
        "Gemini transient failure — retrying",
      );
      options.onAttempt?.({
        attempt: attempt + 1,
        maxAttempts: profile.maxAttempts,
        phase: "retry-scheduled",
        delayMs,
        reason,
      });
      await sleep(delayMs, options.signal);
    }
  }

  throw new AiCallFailure(lastError, attemptLog, Date.now() - startedAt);
}

// ─── User-facing error mapping ───────────────────────────────────────────────

export type MappedGeminiError = { status: number; error: string };

// Runs AFTER the retry loop is exhausted, so every "transient" message here
// already had its 4 chances. Distinguishes the causes a student (or admin)
// can act on; technical detail stays in server logs.
export function mapGeminiError(err: unknown, fallback: string): MappedGeminiError {
  const cause = err instanceof AiCallFailure ? err.cause : err;
  const status = getGeminiStatus(cause);
  const message = cause instanceof Error ? cause.message : String(cause ?? "");

  // Rate limit / overload upstream — retries didn't save it; ask to come back.
  if (status === 429 || status === 500 || status === 502 || status === 503) {
    return {
      status: 503,
      error: "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
    };
  }
  // Unknown or retired model name — the student cannot fix this; say clearly
  // that it's a configuration problem instead of blaming their solution.
  if (status === 404) {
    return {
      status: 502,
      error:
        "Sprawdzanie AI jest chwilowo niedostępne (błąd konfiguracji modelu AI). Zgłoś problem przez formularz kontaktowy.",
    };
  }
  // Invalid/blocked API key or permission problem.
  if (status === 401 || status === 403) {
    return {
      status: 502,
      error:
        "Sprawdzanie AI jest chwilowo niedostępne (błąd konfiguracji klucza AI). Zgłoś problem przez formularz kontaktowy.",
    };
  }
  // Our per-attempt timeout (the SDK aborts the fetch) or upstream deadline.
  if (status === 504 || /abort|timeout|timed out|deadline/i.test(message)) {
    return {
      status: 504,
      error:
        "Usługa AI odpowiada zbyt długo. Twoja praca nie przepadła — spróbuj ponownie za chwilę.",
    };
  }
  // Network-level failure between us and Google.
  if (isNetworkError(cause)) {
    return {
      status: 503,
      error: "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
    };
  }
  return { status: 502, error: fallback };
}
