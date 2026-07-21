// Route-level tests for the two-stage model fallback chain in /ai/check:
//  • 404 self-heal — a rejected model NAME redoes the full retry loop on
//    FALLBACK_AI_MODEL (pre-existing behavior, must keep working),
//  • overload rescue — after a model exhausts its WHOLE retry loop on a
//    transient error (429/5xx), exactly ONE extra attempt runs on the
//    Flash-Lite alias (separate capacity pool),
//  • accounting — every upstream attempt is counted exactly once across the
//    chain (the old code double-counted a rethrown AiCallFailure's attempts).
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, aiUsageLog, aiChecks, aiSettings } from "@workspace/db";

// Runs before all static imports: give env.ts a fake key so isGeminiConfigured()
// is true and the route takes the real (mocked) SDK path instead of demo mode.
const state = vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "test-gemini-key";
  return {
    // Every upstream call in order, by model name — lets tests assert the
    // exact chain (e.g. 4× primary, then 1× lite).
    calls: [] as string[],
    // Per-model plan: how many leading calls fail (Infinity = always) and
    // which HTTP status the failure carries. Unplanned models succeed.
    plans: {} as Record<string, { failures: number; status: number }>,
  };
});

vi.mock("@google/generative-ai", () => {
  const makeResult = (text: string) => ({
    response: {
      text: () => text,
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 20,
        totalTokenCount: 120,
      },
    },
  });
  const httpError = (status: number) => {
    const err = new Error(
      status === 404
        ? "models/unknown is not found for API version v1beta"
        : "The model is overloaded. Please try again later.",
    ) as Error & { status: number };
    err.status = status;
    return err;
  };
  class FakeModel {
    constructor(private modelName: string) {}
    async generateContent(_req: unknown, _opts?: unknown) {
      state.calls.push(this.modelName);
      const plan = state.plans[this.modelName];
      if (plan && plan.failures > 0) {
        plan.failures -= 1;
        throw httpError(plan.status);
      }
      return makeResult(`Ocena z modelu ${this.modelName}`);
    }
  }
  return {
    GoogleGenerativeAI: class {
      constructor(_key?: string) {}
      getGenerativeModel(cfg: { model: string }, _opts?: unknown) {
        return new FakeModel(cfg.model);
      }
    },
  };
});

import app from "../src/app";
import { AI_PROFILES } from "../src/lib/gemini";
import {
  FALLBACK_AI_MODEL,
  OVERLOAD_FALLBACK_AI_MODEL,
} from "../src/lib/ai-settings";
import { createUser, seedCourse, grantAccess } from "./helpers/factories";

// 1×1 transparent PNG — passes validateImageUpload.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// A model name that is neither retired (so resolveAiModel keeps it) nor equal
// to either fallback alias — stands in for a configured-but-dead model.
const DEAD_MODEL = "gemini-omega-9";

const CHECK_ATTEMPTS = AI_PROFILES.check.maxAttempts; // 4

// The real check profile waits 1 s/2 s/4 s between attempts — pointless here.
// Vitest isolates module registries per file, so this cannot leak elsewhere,
// but restore anyway to keep the intent explicit.
const realDelays = [...AI_PROFILES.check.baseDelaysMs];
beforeAll(() => {
  AI_PROFILES.check.baseDelaysMs = [5, 5, 5];
});
afterAll(() => {
  AI_PROFILES.check.baseDelaysMs = realDelays;
});

beforeEach(async () => {
  state.calls = [];
  state.plans = {};
  // ai_settings is not in the global truncate list; leftovers from other
  // suites would silently change the resolved model. Defaults: enabled=true.
  await db.delete(aiSettings);
});

// Pins the admin-configured model explicitly so the tests do not depend on
// the environment's default model name.
async function configureModel(model: string) {
  await db.insert(aiSettings).values({ id: 1, model });
}

async function studentWithCourse() {
  const { user, token } = await createUser();
  const seeded = await seedCourse();
  await grantAccess(user.id, seeded.course.id);
  return { user, token, ...seeded };
}

async function postCheck(token: string, taskId: string | number) {
  return request(app)
    .post("/api/ai/check")
    .set("Authorization", `Bearer ${token}`)
    .send({ taskId, imageBase64: TINY_PNG });
}

async function usageRows() {
  return db.select().from(aiUsageLog).where(eq(aiUsageLog.operation, "check"));
}

describe("POST /api/ai/check — overload rescue on the lite model", () => {
  it(
    "rescues with exactly ONE lite attempt after the primary exhausts its loop on 503",
    async () => {
      await configureModel(FALLBACK_AI_MODEL);
      state.plans[FALLBACK_AI_MODEL] = { failures: Infinity, status: 503 };
      const { token, task } = await studentWithCourse();

      const res = await postCheck(token, task.id);

      expect(res.status).toBe(200);
      expect(res.body.feedback).toContain(OVERLOAD_FALLBACK_AI_MODEL);
      expect(state.calls).toEqual([
        ...Array(CHECK_ATTEMPTS).fill(FALLBACK_AI_MODEL),
        OVERLOAD_FALLBACK_AI_MODEL,
      ]);

      const usage = await usageRows();
      expect(usage).toHaveLength(1);
      expect(usage[0].status).toBe("completed");
      expect(usage[0].model).toBe(OVERLOAD_FALLBACK_AI_MODEL);
      expect(usage[0].attempts).toBe(CHECK_ATTEMPTS + 1);
      expect(usage[0].transient503).toBe(CHECK_ATTEMPTS);
      expect(usage[0].rescuedByRetry).toBe(true);

      const checks = await db.select().from(aiChecks);
      expect(checks).toHaveLength(1);
      expect(checks[0].status).toBe("completed");
      expect(checks[0].model).toBe(OVERLOAD_FALLBACK_AI_MODEL);
      // Admin-log linkage: the usage row points at the check row it produced.
      expect(usage[0].aiCheckId).toBe(checks[0].id);
    },
    15_000,
  );

  it(
    "maps the error and counts every attempt exactly once when the lite rescue also fails",
    async () => {
      await configureModel(FALLBACK_AI_MODEL);
      state.plans[FALLBACK_AI_MODEL] = { failures: Infinity, status: 503 };
      state.plans[OVERLOAD_FALLBACK_AI_MODEL] = { failures: Infinity, status: 503 };
      const { token, task } = await studentWithCourse();

      const res = await postCheck(token, task.id);

      expect(res.status).toBe(503);
      expect(res.body.error).toBe(
        "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
      );
      // Full primary loop + single lite attempt — nothing more.
      expect(state.calls).toEqual([
        ...Array(CHECK_ATTEMPTS).fill(FALLBACK_AI_MODEL),
        OVERLOAD_FALLBACK_AI_MODEL,
      ]);

      const usage = await usageRows();
      expect(usage).toHaveLength(1);
      expect(usage[0].status).toBe("failed");
      expect(usage[0].model).toBe(OVERLOAD_FALLBACK_AI_MODEL);
      // Regression guard: the old chain pushed a rethrown failure's attempts
      // into earlierAttempts AND appended them again in the outer catch.
      expect(usage[0].attempts).toBe(CHECK_ATTEMPTS + 1);
      expect(usage[0].transient503).toBe(CHECK_ATTEMPTS + 1);

      const checks = await db.select().from(aiChecks);
      expect(checks).toHaveLength(1);
      expect(checks[0].status).toBe("failed");
      // Failed calls link to their failed check row too — the admin log shows
      // photo size and task context even for errors.
      expect(usage[0].aiCheckId).toBe(checks[0].id);
    },
    15_000,
  );

  it(
    "does not rescue itself when the configured model already IS the lite alias",
    async () => {
      await configureModel(OVERLOAD_FALLBACK_AI_MODEL);
      state.plans[OVERLOAD_FALLBACK_AI_MODEL] = { failures: Infinity, status: 503 };
      const { token, task } = await studentWithCourse();

      const res = await postCheck(token, task.id);

      expect(res.status).toBe(503);
      // Only the normal retry loop — no extra attempt on the same model.
      expect(state.calls).toEqual(
        Array(CHECK_ATTEMPTS).fill(OVERLOAD_FALLBACK_AI_MODEL),
      );

      const usage = await usageRows();
      expect(usage).toHaveLength(1);
      expect(usage[0].attempts).toBe(CHECK_ATTEMPTS);
    },
    15_000,
  );
});

describe("POST /api/ai/check — 404 fallback chain still intact", () => {
  it(
    "retires a 404 model onto the fallback alias with a full retry loop",
    async () => {
      await configureModel(DEAD_MODEL);
      state.plans[DEAD_MODEL] = { failures: Infinity, status: 404 };
      const { token, task } = await studentWithCourse();

      const res = await postCheck(token, task.id);

      expect(res.status).toBe(200);
      expect(res.body.feedback).toContain(FALLBACK_AI_MODEL);
      // 404 is permanent — one call, no in-loop retries — then the fallback.
      expect(state.calls).toEqual([DEAD_MODEL, FALLBACK_AI_MODEL]);

      const usage = await usageRows();
      expect(usage).toHaveLength(1);
      expect(usage[0].status).toBe("completed");
      expect(usage[0].model).toBe(FALLBACK_AI_MODEL);
      expect(usage[0].attempts).toBe(2);
    },
    15_000,
  );

  it(
    "chains 404 → overloaded fallback (429) → lite rescue",
    async () => {
      await configureModel(DEAD_MODEL);
      state.plans[DEAD_MODEL] = { failures: Infinity, status: 404 };
      // 429 (not 503) proves rate-limit errors trigger the rescue too.
      state.plans[FALLBACK_AI_MODEL] = { failures: Infinity, status: 429 };
      const { token, task } = await studentWithCourse();

      const res = await postCheck(token, task.id);

      expect(res.status).toBe(200);
      expect(res.body.feedback).toContain(OVERLOAD_FALLBACK_AI_MODEL);
      expect(state.calls).toEqual([
        DEAD_MODEL,
        ...Array(CHECK_ATTEMPTS).fill(FALLBACK_AI_MODEL),
        OVERLOAD_FALLBACK_AI_MODEL,
      ]);

      const usage = await usageRows();
      expect(usage).toHaveLength(1);
      expect(usage[0].status).toBe("completed");
      expect(usage[0].model).toBe(OVERLOAD_FALLBACK_AI_MODEL);
      expect(usage[0].attempts).toBe(1 + CHECK_ATTEMPTS + 1);
      expect(usage[0].rescuedByRetry).toBe(true);

      const checks = await db.select().from(aiChecks);
      expect(checks).toHaveLength(1);
      expect(checks[0].model).toBe(OVERLOAD_FALLBACK_AI_MODEL);
    },
    15_000,
  );
});
