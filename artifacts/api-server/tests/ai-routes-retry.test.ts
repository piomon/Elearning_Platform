// Route-level tests for the AI retry pipeline (brief §Testy): the Gemini SDK
// is mocked so we can simulate transient 503s and verify that /ai/check and
// /ai/lesson-chat survive them, that ai_usage_log records attempts/rescues and
// token usage, and that the progress + admin stats endpoints respond.
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, aiUsageLog, aiChecks, aiSettings } from "@workspace/db";

// Runs before all static imports: give env.ts a fake key so isGeminiConfigured()
// is true and routes take the real (mocked) SDK path instead of demo mode.
const state = vi.hoisted(() => {
  process.env.GEMINI_API_KEY = "test-gemini-key";
  return {
    checkFailures: 0,
    chatFailures: 0,
    checkCalls: 0,
    chatCalls: 0,
  };
});

vi.mock("@google/generative-ai", () => {
  const makeResult = (text: string) => ({
    response: {
      text: () => text,
      usageMetadata: {
        promptTokenCount: 120,
        candidatesTokenCount: 40,
        totalTokenCount: 160,
      },
    },
  });
  const transient503 = () => {
    const err = new Error(
      "The model is overloaded. Please try again later.",
    ) as Error & { status: number };
    err.status = 503;
    return err;
  };
  class FakeModel {
    async generateContent(_req: unknown, _opts?: unknown) {
      state.checkCalls += 1;
      if (state.checkCalls <= state.checkFailures) throw transient503();
      return makeResult("Świetna robota! Rozwiązanie jest poprawne.");
    }
    startChat(_cfg?: unknown) {
      return {
        sendMessage: async (_msg: unknown, _opts?: unknown) => {
          state.chatCalls += 1;
          if (state.chatCalls <= state.chatFailures) throw transient503();
          return makeResult("Siła to oddziaływanie, które może zmienić ruch ciała.");
        },
      };
    }
  }
  return {
    GoogleGenerativeAI: class {
      constructor(_key?: string) {}
      getGenerativeModel(_cfg?: unknown, _opts?: unknown) {
        return new FakeModel();
      }
    },
  };
});

import app from "../src/app";
import { createUser, createAdmin, seedCourse, grantAccess } from "./helpers/factories";

// 1×1 transparent PNG — passes validateImageUpload.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

beforeEach(async () => {
  state.checkFailures = 0;
  state.chatFailures = 0;
  state.checkCalls = 0;
  state.chatCalls = 0;
  // ai_settings is intentionally NOT in the global truncate list, so a row
  // left by another suite (e.g. admin tests disabling AI) would leak in here.
  // Deleting it makes getAiSettings() fall back to defaults (enabled=true).
  await db.delete(aiSettings);
});

async function studentWithCourse() {
  const { user, token } = await createUser();
  const seeded = await seedCourse();
  await grantAccess(user.id, seeded.course.id);
  return { user, token, ...seeded };
}

describe("POST /api/ai/check — retry pipeline", () => {
  it(
    "survives a transient 503 and logs the rescue in ai_usage_log",
    async () => {
      state.checkFailures = 1; // first upstream call fails, retry succeeds
      const { token, task } = await studentWithCourse();

      const res = await request(app)
        .post("/api/ai/check")
        .set("Authorization", `Bearer ${token}`)
        .send({ taskId: task.id, imageBase64: TINY_PNG, requestId: "check-retry-test-1" });

      expect(res.status).toBe(200);
      expect(res.body.feedback).toContain("Świetna robota");
      expect(state.checkCalls).toBe(2);

      const usage = await db
        .select()
        .from(aiUsageLog)
        .where(eq(aiUsageLog.operation, "check"));
      expect(usage).toHaveLength(1);
      expect(usage[0].status).toBe("completed");
      expect(usage[0].attempts).toBe(2);
      expect(usage[0].rescuedByRetry).toBe(true);
      expect(usage[0].transient503).toBe(1);
      expect(usage[0].inputTokens).toBe(120);
      expect(usage[0].outputTokens).toBe(40);
      expect(usage[0].estCostGrosz).not.toBeNull();

      // The student-visible history row is completed too.
      const checks = await db.select().from(aiChecks);
      expect(checks).toHaveLength(1);
      expect(checks[0].status).toBe("completed");
    },
    15_000,
  );

  it("succeeds first-try with attempts=1 and ignores a malformed requestId", async () => {
    const { token, task } = await studentWithCourse();

    const res = await request(app)
      .post("/api/ai/check")
      .set("Authorization", `Bearer ${token}`)
      .send({ taskId: task.id, imageBase64: TINY_PNG, requestId: "zły id!" });

    expect(res.status).toBe(200);
    const usage = await db.select().from(aiUsageLog);
    expect(usage).toHaveLength(1);
    expect(usage[0].attempts).toBe(1);
    expect(usage[0].rescuedByRetry).toBe(false);
  });
});

describe("POST /api/ai/lesson-chat — cheap model + retry", () => {
  it(
    "survives a transient 503 and records the cheap chat model",
    async () => {
      state.chatFailures = 1;
      const { token, topic } = await studentWithCourse();

      const res = await request(app)
        .post("/api/ai/lesson-chat")
        .set("Authorization", `Bearer ${token}`)
        .send({
          topicId: topic.id,
          message: "Czym jest siła?",
          history: [],
          requestId: "chat-retry-test-1",
        });

      expect(res.status).toBe(200);
      expect(res.body.reply).toContain("oddziaływanie");
      expect(state.chatCalls).toBe(2);

      const usage = await db
        .select()
        .from(aiUsageLog)
        .where(eq(aiUsageLog.operation, "chat"));
      expect(usage).toHaveLength(1);
      expect(usage[0].status).toBe("completed");
      expect(usage[0].attempts).toBe(2);
      expect(usage[0].rescuedByRetry).toBe(true);
      // The assistant must run on the cheap model by default.
      expect(usage[0].model).toContain("flash-lite");
    },
    15_000,
  );
});

describe("GET /api/ai/progress/:requestId", () => {
  it("requires auth and 404s for unknown or malformed ids", async () => {
    const noAuth = await request(app).get("/api/ai/progress/some-request-id-123");
    expect(noAuth.status).toBe(401);

    const { token } = await createUser();
    const unknown = await request(app)
      .get("/api/ai/progress/unknown-request-id-123")
      .set("Authorization", `Bearer ${token}`);
    expect(unknown.status).toBe(404);

    const malformed = await request(app)
      .get("/api/ai/progress/ab") // too short for the id format
      .set("Authorization", `Bearer ${token}`);
    expect(malformed.status).toBe(400);
  });
});

describe("GET /api/admin/ai-usage/stats", () => {
  it("aggregates per-operation usage for admins only", async () => {
    await db.insert(aiUsageLog).values([
      {
        userId: null,
        operation: "check",
        model: "gemini-flash-latest",
        status: "completed",
        attempts: 2,
        rescuedByRetry: true,
        transient429: 0,
        transient503: 1,
        inputTokens: 1000,
        outputTokens: 200,
        totalTokens: 1200,
        estCostGrosz: "0.250000",
        latencyMs: 900,
      },
      {
        userId: null,
        operation: "chat",
        model: "gemini-flash-lite-latest",
        status: "failed",
        httpStatus: 503,
        attempts: 4,
        rescuedByRetry: false,
        transient429: 0,
        transient503: 4,
        latencyMs: 8000,
        errorMessage: "overloaded",
      },
    ]);

    const { token: userToken } = await createUser();
    const forbidden = await request(app)
      .get("/api/admin/ai-usage/stats")
      .set("Authorization", `Bearer ${userToken}`);
    expect(forbidden.status).toBe(403);

    const { token: adminToken } = await createAdmin();
    const res = await request(app)
      .get("/api/admin/ai-usage/stats?days=7")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);

    const byOp = Object.fromEntries(
      (res.body.operations as Array<{ operation: string } & Record<string, unknown>>).map(
        (o) => [o.operation, o],
      ),
    );
    expect(byOp.check.total).toBe(1);
    expect(byOp.check.completed).toBe(1);
    expect(byOp.check.rescuedByRetry).toBe(1);
    expect(byOp.check.errors503).toBe(1);
    expect(byOp.check.totalCostGrosz).toBe(0.25);
    expect(byOp.chat.total).toBe(1);
    expect(byOp.chat.completed).toBe(0);
    expect(byOp.chat.errors503).toBe(4);
  });

  it("clamps the days parameter", async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get("/api/admin/ai-usage/stats?days=5000")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(90);
  });
});
