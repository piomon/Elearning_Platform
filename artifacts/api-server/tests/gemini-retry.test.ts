import { describe, it, expect } from "vitest";
import {
  AiCallFailure,
  AiOperationAborted,
  callGeminiWithRetry,
  computeRetryDelayMs,
  getGeminiStatus,
  inFlightCount,
  isTransientGeminiError,
  MAX_SERVER_RETRY_DELAY_MS,
  type AiProgressUpdate,
  type AiRetryProfile,
} from "../src/lib/gemini";

// Millisecond-scale profile so retry tests run fast; the shape mirrors the
// real profiles (4 attempts, growing backoff).
const FAST: Partial<AiRetryProfile> = {
  attemptTimeoutMs: 1_000,
  totalBudgetMs: 10_000,
  maxAttempts: 4,
  baseDelaysMs: [1, 1, 1],
};

function httpError(status: number, message = `HTTP ${status}`) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

describe("callGeminiWithRetry", () => {
  it("returns on first success without marking a rescue", async () => {
    let calls = 0;
    const outcome = await callGeminiWithRetry({
      operation: "chat",
      profile: FAST,
      fn: async () => {
        calls += 1;
        return "ok";
      },
    });
    expect(outcome.value).toBe("ok");
    expect(calls).toBe(1);
    expect(outcome.attempts).toBe(1);
    expect(outcome.rescuedByRetry).toBe(false);
    expect(outcome.attemptLog).toHaveLength(1);
    expect(outcome.attemptLog[0].ok).toBe(true);
  });

  it("rescues after transient 503s and reports live progress", async () => {
    let calls = 0;
    const updates: AiProgressUpdate[] = [];
    const outcome = await callGeminiWithRetry({
      operation: "chat",
      profile: FAST,
      onAttempt: (u) => updates.push(u),
      fn: async () => {
        calls += 1;
        if (calls <= 2) throw httpError(503, "Service overloaded");
        return "uratowane";
      },
    });
    expect(outcome.value).toBe("uratowane");
    expect(outcome.attempts).toBe(3);
    expect(outcome.rescuedByRetry).toBe(true);
    expect(outcome.attemptLog.map((a) => a.ok)).toEqual([false, false, true]);
    expect(outcome.attemptLog[0].httpStatus).toBe(503);

    const phases = updates.map((u) => `${u.phase}:${u.attempt}`);
    expect(phases).toEqual([
      "calling:1",
      "retry-scheduled:2",
      "calling:2",
      "retry-scheduled:3",
      "calling:3",
    ]);
  });

  it("does NOT retry non-transient errors (e.g. 400)", async () => {
    let calls = 0;
    const promise = callGeminiWithRetry({
      operation: "chat",
      profile: FAST,
      fn: async () => {
        calls += 1;
        throw httpError(400, "Bad request");
      },
    });
    await expect(promise).rejects.toBeInstanceOf(AiCallFailure);
    expect(calls).toBe(1);
    const failure = await promise.catch((e) => e as AiCallFailure);
    expect(failure.attempts).toBe(1);
    // Status must be readable through the wrapper for route error mapping.
    expect(getGeminiStatus(failure)).toBe(400);
  });

  it("stops at the attempt cap when the error persists", async () => {
    let calls = 0;
    const promise = callGeminiWithRetry({
      operation: "chat",
      profile: FAST,
      fn: async () => {
        calls += 1;
        throw httpError(503);
      },
    });
    await expect(promise).rejects.toBeInstanceOf(AiCallFailure);
    expect(calls).toBe(4);
    const failure = await promise.catch((e) => e as AiCallFailure);
    expect(failure.attemptLog).toHaveLength(4);
    expect(getGeminiStatus(failure)).toBe(503);
  });

  it("gives up early when the remaining budget cannot fit another attempt", async () => {
    let calls = 0;
    const promise = callGeminiWithRetry({
      operation: "chat",
      profile: {
        attemptTimeoutMs: 1_000,
        totalBudgetMs: 200,
        maxAttempts: 4,
        baseDelaysMs: [10_000],
      },
      fn: async () => {
        calls += 1;
        throw httpError(503);
      },
    });
    await expect(promise).rejects.toBeInstanceOf(AiCallFailure);
    expect(calls).toBe(1);
  });

  it("aborts a scheduled retry when the client disconnects", async () => {
    const controller = new AbortController();
    const promise = callGeminiWithRetry({
      operation: "chat",
      profile: { ...FAST, baseDelaysMs: [500, 500, 500] },
      signal: controller.signal,
      fn: async () => {
        throw httpError(503);
      },
    });
    setTimeout(() => controller.abort(), 50);
    await expect(promise).rejects.toBeInstanceOf(AiOperationAborted);
  });

  it("deduplicates identical concurrent calls into one upstream request", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const fn = async () => {
      calls += 1;
      await gate;
      return "wspólny wynik";
    };
    const p1 = callGeminiWithRetry({ operation: "check", profile: FAST, dedupeKey: "same", fn });
    const p2 = callGeminiWithRetry({ operation: "check", profile: FAST, dedupeKey: "same", fn });
    expect(inFlightCount()).toBe(1);
    release();
    const [o1, o2] = await Promise.all([p1, p2]);
    expect(calls).toBe(1);
    expect(o1.value).toBe("wspólny wynik");
    expect(o2.value).toBe("wspólny wynik");
    // Only the joiner is flagged — the owner logs usage, the joiner must not.
    expect(o1.sharedFromDedupe ?? false).toBe(false);
    expect(o2.sharedFromDedupe).toBe(true);
    expect(inFlightCount()).toBe(0);
  });

  it("keeps different dedupe keys separate", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return calls;
    };
    const [a, b] = await Promise.all([
      callGeminiWithRetry({ operation: "check", profile: FAST, dedupeKey: "k1", fn }),
      callGeminiWithRetry({ operation: "check", profile: FAST, dedupeKey: "k2", fn }),
    ]);
    expect(calls).toBe(2);
    expect(a.sharedFromDedupe ?? false).toBe(false);
    expect(b.sharedFromDedupe ?? false).toBe(false);
  });

  it("flags a shared failure so it is logged exactly once", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      throw httpError(503, "Service overloaded");
    };
    const results = await Promise.allSettled([
      callGeminiWithRetry({
        operation: "check",
        profile: { ...FAST, maxAttempts: 2 },
        dedupeKey: "fail-shared",
        fn,
      }),
      callGeminiWithRetry({
        operation: "check",
        profile: { ...FAST, maxAttempts: 2 },
        dedupeKey: "fail-shared",
        fn,
      }),
    ]);
    // One upstream run (2 attempts) shared by both callers.
    expect(calls).toBe(2);
    const failures = results.map((r) => {
      expect(r.status).toBe("rejected");
      const err = (r as PromiseRejectedResult).reason as unknown;
      expect(err).toBeInstanceOf(AiCallFailure);
      return err as AiCallFailure;
    });
    // Exactly ONE caller owns usage accounting; the other is flagged shared.
    expect(failures.filter((f) => f.sharedFromDedupe)).toHaveLength(1);
    expect(failures.filter((f) => !f.sharedFromDedupe)).toHaveLength(1);
    expect(failures.find((f) => f.sharedFromDedupe)!.attemptLog).toHaveLength(2);
    expect(inFlightCount()).toBe(0);
  });

  it("keeps the shared call alive for the joiner when the owner disconnects", async () => {
    const ownerAbort = new AbortController();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let upstreamAborted = false;
    const fn = async ({ signal }: { signal?: AbortSignal }) => {
      signal?.addEventListener("abort", () => {
        upstreamAborted = true;
      });
      await gate;
      return "przetrwało";
    };
    const owner = callGeminiWithRetry({
      operation: "check",
      profile: FAST,
      dedupeKey: "owner-leaves",
      signal: ownerAbort.signal,
      fn,
    });
    const joiner = callGeminiWithRetry({
      operation: "check",
      profile: FAST,
      dedupeKey: "owner-leaves",
      fn,
    });
    ownerAbort.abort();
    await expect(owner).rejects.toBeInstanceOf(AiOperationAborted);
    release();
    const outcome = await joiner;
    expect(outcome.value).toBe("przetrwało");
    // The upstream call must survive the owner's disconnect…
    expect(upstreamAborted).toBe(false);
    // …and the surviving joiner inherits usage accounting (NOT flagged).
    expect(outcome.sharedFromDedupe ?? false).toBe(false);
    expect(inFlightCount()).toBe(0);
  });

  it("lets a joiner disconnect without cancelling the owner's call", async () => {
    const joinerAbort = new AbortController();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let upstreamAborted = false;
    const fn = async ({ signal }: { signal?: AbortSignal }) => {
      signal?.addEventListener("abort", () => {
        upstreamAborted = true;
      });
      await gate;
      return "właściciel kończy";
    };
    const owner = callGeminiWithRetry({
      operation: "check",
      profile: FAST,
      dedupeKey: "joiner-leaves",
      fn,
    });
    const joiner = callGeminiWithRetry({
      operation: "check",
      profile: FAST,
      dedupeKey: "joiner-leaves",
      signal: joinerAbort.signal,
      fn,
    });
    joinerAbort.abort();
    await expect(joiner).rejects.toBeInstanceOf(AiOperationAborted);
    release();
    const outcome = await owner;
    expect(outcome.value).toBe("właściciel kończy");
    expect(outcome.sharedFromDedupe ?? false).toBe(false);
    expect(upstreamAborted).toBe(false);
    expect(inFlightCount()).toBe(0);
  });
});

describe("isTransientGeminiError", () => {
  it("classifies statuses per the brief", () => {
    for (const status of [429, 500, 502, 503, 504]) {
      expect(isTransientGeminiError(httpError(status))).toBe(true);
    }
    for (const status of [400, 401, 403, 404]) {
      expect(isTransientGeminiError(httpError(status))).toBe(false);
    }
  });
});

describe("computeRetryDelayMs", () => {
  const profile: AiRetryProfile = {
    attemptTimeoutMs: 1_000,
    totalBudgetMs: 10_000,
    maxAttempts: 4,
    baseDelaysMs: [1_000, 2_000, 4_000],
  };

  it("applies jitter in the 0.5×–1.5× band", () => {
    expect(computeRetryDelayMs(2, httpError(503), profile, () => 0)).toBe(500);
    expect(computeRetryDelayMs(2, httpError(503), profile, () => 1)).toBe(1_500);
    expect(computeRetryDelayMs(3, httpError(503), profile, () => 0.5)).toBe(2_000);
  });

  it("clamps the delay index to the last configured base", () => {
    expect(computeRetryDelayMs(9, httpError(503), profile, () => 0.5)).toBe(4_000);
  });

  it("honors a google.rpc.RetryInfo hint (never waiting less)", () => {
    const err = httpError(429) as Error & { status: number; errorDetails?: unknown };
    err.errorDetails = [
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "7s" },
    ];
    expect(computeRetryDelayMs(2, err, profile, () => 0)).toBe(7_000);
  });

  it("caps an excessive server hint", () => {
    const err = httpError(429) as Error & { status: number; errorDetails?: unknown };
    err.errorDetails = [
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "60s" },
    ];
    expect(computeRetryDelayMs(2, err, profile, () => 0)).toBe(MAX_SERVER_RETRY_DELAY_MS);
  });

  it("parses a retryDelay embedded in the error message", () => {
    const err = httpError(429, '429 Too Many Requests ... "retryDelay":"3s" ...');
    expect(computeRetryDelayMs(2, err, profile, () => 0)).toBe(3_000);
  });

  it("parses protobuf-style {seconds} retryDelay objects", () => {
    const err = httpError(429) as Error & { status: number; errorDetails?: unknown };
    err.errorDetails = [
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: { seconds: 2 } },
    ];
    expect(computeRetryDelayMs(2, err, profile, () => 0)).toBe(2_000);
  });
});
