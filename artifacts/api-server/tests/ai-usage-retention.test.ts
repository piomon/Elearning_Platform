// Retention for ai_usage_log (lib/ai-usage-retention.ts): raw rows older than
// the retention window are summed into ai_usage_daily_stats and deleted, in
// one transaction. Covers: correct rollup values, recent rows untouched,
// idempotent re-run (no double counting), additive merge onto an existing
// daily row, and the stats endpoint staying truthful after cleanup.
import { describe, it, expect } from "vitest";
import request from "supertest";
import { asc, eq } from "drizzle-orm";
import { db, aiUsageLog, aiUsageDailyStats } from "@workspace/db";
import app from "../src/app";
import { createAdmin } from "./helpers/factories";
import { runAiUsageRetention, retentionCutoff } from "../src/lib/ai-usage-retention";
import { config } from "../src/config/env";

const NOW = new Date("2026-07-21T12:00:00Z");
// Older than the retention window regardless of the configured months (>120m? no —
// use cutoff-relative dates instead of absolute ones).
function monthsBeforeCutoff(months: number): Date {
  const d = new Date(retentionCutoff(NOW));
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function oldRow(overrides: Partial<typeof aiUsageLog.$inferInsert> = {}) {
  return {
    userId: null,
    operation: "check",
    model: "gemini-flash-latest",
    status: "completed",
    attempts: 1,
    rescuedByRetry: false,
    transient429: 0,
    transient503: 0,
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    estCostGrosz: "1.500000",
    latencyMs: 2000,
    createdAt: monthsBeforeCutoff(1),
    ...overrides,
  };
}

describe("runAiUsageRetention", () => {
  it("rolls expired rows into daily stats and deletes them; recent rows survive", async () => {
    const oldDay = monthsBeforeCutoff(1);
    await db.insert(aiUsageLog).values([
      oldRow({ createdAt: oldDay }),
      oldRow({
        createdAt: oldDay,
        status: "failed",
        httpStatus: 503,
        transient503: 2,
        attempts: 3,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        estCostGrosz: null,
        latencyMs: 4000,
      }),
      oldRow({
        createdAt: oldDay,
        operation: "chat",
        model: "gemini-flash-lite-latest",
        rescuedByRetry: true,
        attempts: 2,
        transient429: 1,
        estCostGrosz: "0.250000",
      }),
      // Recent row — must NOT be touched.
      oldRow({ createdAt: new Date(NOW.getTime() - 86_400_000) }),
    ]);

    const result = await runAiUsageRetention(NOW);
    expect(result.deletedRows).toBe(3);
    expect(result.aggregatedDays).toBe(2); // (check, flash) + (chat, flash-lite)

    const remaining = await db.select().from(aiUsageLog);
    expect(remaining).toHaveLength(1);

    const daily = await db
      .select()
      .from(aiUsageDailyStats)
      .orderBy(asc(aiUsageDailyStats.operation));

    expect(daily).toHaveLength(2);
    const check = daily.find((d) => d.operation === "check")!;
    expect(check.model).toBe("gemini-flash-latest");
    expect(check.requests).toBe(2);
    expect(check.completed).toBe(1);
    expect(check.failed).toBe(1);
    expect(check.transient503).toBe(2);
    expect(check.inputTokens).toBe(1000);
    expect(check.outputTokens).toBe(500);
    expect(Number(check.estCostGrosz)).toBeCloseTo(1.5, 6);
    expect(check.latencyMsSum).toBe(6000);

    const chat = daily.find((d) => d.operation === "chat")!;
    expect(chat.requests).toBe(1);
    expect(chat.rescuedByRetry).toBe(1);
    expect(chat.transient429).toBe(1);
    expect(Number(chat.estCostGrosz)).toBeCloseTo(0.25, 6);
  });

  it("is idempotent: a second run deletes nothing and does not double-count", async () => {
    await db.insert(aiUsageLog).values([oldRow(), oldRow()]);

    const first = await runAiUsageRetention(NOW);
    expect(first.deletedRows).toBe(2);

    const second = await runAiUsageRetention(NOW);
    expect(second.deletedRows).toBe(0);
    expect(second.aggregatedDays).toBe(0);

    const daily = await db.select().from(aiUsageDailyStats);
    expect(daily).toHaveLength(1);
    expect(daily[0].requests).toBe(2);
  });

  it("merges additively onto an existing daily row (later run, same day)", async () => {
    const day = monthsBeforeCutoff(1);
    await db.insert(aiUsageLog).values([oldRow({ createdAt: day })]);
    await runAiUsageRetention(NOW);

    // A straggler row from the same calendar day expires in a later run.
    await db.insert(aiUsageLog).values([oldRow({ createdAt: day, estCostGrosz: "0.500000" })]);
    const result = await runAiUsageRetention(NOW);
    expect(result.deletedRows).toBe(1);

    const daily = await db.select().from(aiUsageDailyStats);
    expect(daily).toHaveLength(1);
    expect(daily[0].requests).toBe(2);
    expect(Number(daily[0].estCostGrosz)).toBeCloseTo(2.0, 6);
  });

  it("retention floor (>=4 months) keeps the 90-day admin stats window on raw rows", async () => {
    expect(config.ai.usageRetentionMonths).toBeGreaterThanOrEqual(4);

    // Row inside the max stats window (89 days old) must survive retention...
    const within = new Date(NOW.getTime() - 89 * 86_400_000);
    await db.insert(aiUsageLog).values([oldRow({ createdAt: within })]);
    await runAiUsageRetention(NOW);
    const remaining = await db.select().from(aiUsageLog);
    expect(remaining).toHaveLength(1);

    // ...so /admin/ai-usage/stats still counts it.
    const { token } = await createAdmin();
    const res = await request(app)
      .get("/api/admin/ai-usage/stats?days=90")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const checkStats = res.body.operations.find(
      (o: { operation: string }) => o.operation === "check",
    );
    expect(checkStats.total).toBe(1);
    expect(checkStats.totalCostGrosz).toBeCloseTo(1.5, 2);
  });
});
