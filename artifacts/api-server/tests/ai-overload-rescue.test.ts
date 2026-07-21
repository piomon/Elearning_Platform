import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { db } from "@workspace/db";
import { aiSettings, aiUsageLog } from "@workspace/db";
import app from "../src/app";
import { createAdmin } from "./helpers/factories";
import { OVERLOAD_FALLBACK_AI_MODEL } from "../src/lib/ai-settings";

// The admin AI-settings panel shows how often the peak-hour overload rescue
// (one attempt on the Flash-Lite alias after a full retry loop exhausted on
// 429/5xx) saved checks in the last 24 h — `overloadRescue` in
// GET/PUT /admin/ai-settings.
describe("Overload-rescue stats (admin AI settings)", () => {
  beforeEach(async () => {
    // ai_settings is a singleton row shared across suites (intentionally not
    // in the global truncate list) — reset it so leftovers don't leak in.
    await db.delete(aiSettings);
    await db.delete(aiUsageLog);
  });

  afterAll(async () => {
    await db.delete(aiSettings);
    await db.delete(aiUsageLog);
  });

  async function getSettings(token: string) {
    const res = await request(app)
      .get("/api/admin/ai-settings")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body;
  }

  it("counts rescued and still-failed checks on the lite model from the last 24h", async () => {
    const { user, token } = await createAdmin();
    const base = {
      userId: user.id,
      operation: "check",
      model: OVERLOAD_FALLBACK_AI_MODEL,
      latencyMs: 1000,
    };
    await db.insert(aiUsageLog).values([
      // Rescued: chained onto the lite model after an exhausted retry loop.
      { ...base, status: "completed", attempts: 4 },
      { ...base, status: "completed", attempts: 5 },
      // Rescue attempted, but the lite model failed too.
      { ...base, status: "failed", attempts: 4 },
      // attempts = 1 means lite was simply the configured model — not a rescue.
      { ...base, status: "completed", attempts: 1 },
      // Chat runs on the lite model by design — a different operation.
      { ...base, operation: "chat", status: "completed", attempts: 3 },
      // Outside the 24h window.
      {
        ...base,
        status: "completed",
        attempts: 4,
        createdAt: new Date(Date.now() - 25 * 3_600_000),
      },
    ]);

    const body = await getSettings(token);
    expect(body.overloadRescue).toEqual({
      rescued: 2,
      failed: 1,
      lastAt: expect.any(String),
      rescueModel: OVERLOAD_FALLBACK_AI_MODEL,
    });
  });

  it("is null when the last 24h are clean (indicator disappears)", async () => {
    const { user, token } = await createAdmin();
    await db.insert(aiUsageLog).values({
      userId: user.id,
      operation: "check",
      model: "gemini-flash-latest",
      status: "completed",
      attempts: 2,
      latencyMs: 1000,
    });

    const body = await getSettings(token);
    expect(body.overloadRescue).toBeNull();
  });

  it("is included in the PUT response as well", async () => {
    const { user, token } = await createAdmin();
    await db.insert(aiUsageLog).values({
      userId: user.id,
      operation: "check",
      model: OVERLOAD_FALLBACK_AI_MODEL,
      status: "completed",
      attempts: 3,
      latencyMs: 1000,
    });

    const res = await request(app)
      .put("/api/admin/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.overloadRescue?.rescued).toBe(1);
    expect(res.body.overloadRescue?.failed).toBe(0);
  });
});
