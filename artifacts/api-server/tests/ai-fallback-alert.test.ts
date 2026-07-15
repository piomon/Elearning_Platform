import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { db } from "@workspace/db";
import { aiChecks, aiSettings } from "@workspace/db";
import app from "../src/app";
import { createAdmin, seedCourse } from "./helpers/factories";
import { FALLBACK_AI_MODEL } from "../src/lib/ai-settings";

// The admin AI-settings panel warns when recent checks ran on the fallback
// alias while the configuration points at a different model — i.e. the
// retired-model safety net engaged. These tests cover the detection behind
// that warning (`fallbackAlert` in GET/PUT /admin/ai-settings).
describe("Fallback-model alert (admin AI settings)", () => {
  beforeEach(async () => {
    // ai_settings is a singleton row shared across suites (intentionally not
    // in the global truncate list) — reset it so leftovers don't leak in.
    await db.delete(aiSettings);
    await db.delete(aiChecks);
  });

  afterAll(async () => {
    await db.delete(aiSettings);
    await db.delete(aiChecks);
  });

  async function setModel(token: string, model: string) {
    const res = await request(app)
      .put("/api/admin/ai-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ model });
    expect(res.status).toBe(200);
    return res.body;
  }

  it("warns when checks from the last 24h ran on the fallback model", async () => {
    const { user, token } = await createAdmin();
    const { task, topic } = await seedCourse();
    await setModel(token, "gemini-2.5-pro");

    const base = { userId: user.id, taskId: task.id, topicId: topic.id, status: "completed" };
    await db.insert(aiChecks).values([
      // Fallback engaged within the window — must be counted.
      { ...base, model: FALLBACK_AI_MODEL },
      // Fallback, but older than 24h — outside the window.
      { ...base, model: FALLBACK_AI_MODEL, createdAt: new Date(Date.now() - 25 * 3_600_000) },
      // Normal check on the configured model — not a fallback.
      { ...base, model: "gemini-2.5-pro" },
    ]);

    const res = await request(app)
      .get("/api/admin/ai-settings")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.fallbackAlert).toEqual({
      count: 1,
      lastAt: expect.any(String),
      configuredModel: "gemini-2.5-pro",
      fallbackModel: FALLBACK_AI_MODEL,
    });
  });

  it("stays silent when all checks used the configured model", async () => {
    const { user, token } = await createAdmin();
    const { task, topic } = await seedCourse();
    await setModel(token, "gemini-2.5-pro");

    await db.insert(aiChecks).values({
      userId: user.id,
      taskId: task.id,
      topicId: topic.id,
      status: "completed",
      model: "gemini-2.5-pro",
    });

    const res = await request(app)
      .get("/api/admin/ai-settings")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.fallbackAlert).toBeNull();
  });

  it("clears immediately when the admin clears the model field", async () => {
    const { user, token } = await createAdmin();
    const { task, topic } = await seedCourse();
    await setModel(token, "gemini-1.5-flash"); // retired name — checks run on the fallback

    await db.insert(aiChecks).values({
      userId: user.id,
      taskId: task.id,
      topicId: topic.id,
      status: "completed",
      model: FALLBACK_AI_MODEL,
    });

    // Warning present while the config points at the dead model…
    const before = await request(app)
      .get("/api/admin/ai-settings")
      .set("Authorization", `Bearer ${token}`);
    expect(before.body.fallbackAlert?.count).toBe(1);
    expect(before.body.fallbackAlert?.configuredModel).toBe("gemini-1.5-flash");

    // …and the PUT response reflects the fix at once: an empty field falls
    // back to the env default, which is the rolling alias in this environment,
    // so fallback-model checks are no longer anomalies.
    const updated = await setModel(token, "");
    expect(updated.fallbackAlert).toBeNull();
  });
});
