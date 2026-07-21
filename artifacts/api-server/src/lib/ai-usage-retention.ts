// Retention for ai_usage_log (brief: "nie pozwól, by dziennik żądań AI rósł w
// nieskończoność"). Policy: raw rows (including the JSONB attemptLog) are kept
// for AI_USAGE_RETENTION_MONTHS (default 12); anything older is summed into
// ai_usage_daily_stats — one row per (UTC day, operation, model) with request
// counts, token sums and estimated cost — and then deleted. Aggregated cost
// history therefore survives forever while the raw table stays bounded.
//
// Idempotency: aggregation + deletion happen in ONE transaction over the same
// cutoff, so each raw row is counted exactly once — a re-run (or a crash
// between runs) can never double-count, because rows that were aggregated no
// longer exist. The daily upsert is additive only to merge separate runs that
// touch the same calendar day.
//
// The admin stats window (/admin/ai-usage/stats) is capped at 90 days and the
// retention floor is 4 months, so stats always read raw rows only and stay
// truthful after cleanup.

import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { config } from "../config/env";
import { logger } from "./logger";

export interface AiUsageRetentionResult {
  cutoff: Date;
  deletedRows: number;
  aggregatedDays: number;
}

/** First millisecond of the retained window: rows strictly older are rolled up. */
export function retentionCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - config.ai.usageRetentionMonths);
  return cutoff;
}

// Runs the rollup+delete in a single transaction. Safe to call repeatedly —
// a run with nothing to do deletes 0 rows and touches nothing.
export async function runAiUsageRetention(now = new Date()): Promise<AiUsageRetentionResult> {
  const cutoff = retentionCutoff(now);

  const result = await db.transaction(async (tx) => {
    // Roll expiring raw rows up into daily stats. Additive ON CONFLICT merges
    // with days already present from earlier runs.
    const aggregated = await tx.execute(sql`
      INSERT INTO ai_usage_daily_stats
        (day, operation, model, requests, completed, failed, rescued_by_retry,
         transient_429, transient_503, input_tokens, output_tokens, total_tokens,
         est_cost_grosz, latency_ms_sum, updated_at)
      SELECT
        (created_at AT TIME ZONE 'UTC')::date AS day,
        operation,
        model,
        count(*)::int,
        count(*) FILTER (WHERE status = 'completed')::int,
        count(*) FILTER (WHERE status = 'failed')::int,
        count(*) FILTER (WHERE rescued_by_retry AND status = 'completed')::int,
        coalesce(sum(transient_429), 0)::int,
        coalesce(sum(transient_503), 0)::int,
        coalesce(sum(input_tokens), 0)::bigint,
        coalesce(sum(output_tokens), 0)::bigint,
        coalesce(sum(total_tokens), 0)::bigint,
        coalesce(sum(est_cost_grosz), 0),
        coalesce(sum(latency_ms), 0)::bigint,
        now()
      FROM ai_usage_log
      WHERE created_at < ${cutoff}
      GROUP BY 1, 2, 3
      ON CONFLICT (day, operation, model) DO UPDATE SET
        requests = ai_usage_daily_stats.requests + excluded.requests,
        completed = ai_usage_daily_stats.completed + excluded.completed,
        failed = ai_usage_daily_stats.failed + excluded.failed,
        rescued_by_retry = ai_usage_daily_stats.rescued_by_retry + excluded.rescued_by_retry,
        transient_429 = ai_usage_daily_stats.transient_429 + excluded.transient_429,
        transient_503 = ai_usage_daily_stats.transient_503 + excluded.transient_503,
        input_tokens = ai_usage_daily_stats.input_tokens + excluded.input_tokens,
        output_tokens = ai_usage_daily_stats.output_tokens + excluded.output_tokens,
        total_tokens = ai_usage_daily_stats.total_tokens + excluded.total_tokens,
        est_cost_grosz = ai_usage_daily_stats.est_cost_grosz + excluded.est_cost_grosz,
        latency_ms_sum = ai_usage_daily_stats.latency_ms_sum + excluded.latency_ms_sum,
        updated_at = excluded.updated_at
    `);

    // Delete exactly what was aggregated — same cutoff, same transaction.
    const deleted = await tx.execute(sql`
      DELETE FROM ai_usage_log WHERE created_at < ${cutoff}
    `);

    return {
      aggregatedDays: aggregated.rowCount ?? 0,
      deletedRows: deleted.rowCount ?? 0,
    };
  });

  logger.info(
    {
      aiUsageRetention: {
        cutoff: cutoff.toISOString(),
        retentionMonths: config.ai.usageRetentionMonths,
        deletedRows: result.deletedRows,
        aggregatedDays: result.aggregatedDays,
      },
    },
    result.deletedRows > 0
      ? `AI usage retention: rolled ${result.deletedRows} raw rows into ${result.aggregatedDays} daily stat rows`
      : "AI usage retention: nothing to clean",
  );

  return { cutoff, ...result };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Fire once shortly after boot, then every 24h. Failures are logged and the
// next run retries — the cleanup must never take the server down.
export function scheduleAiUsageRetention(): void {
  const run = () => {
    runAiUsageRetention().catch((err) => {
      logger.error({ err }, "AI usage retention run failed");
    });
  };
  // Small delay so boot (incl. migrations elsewhere in the stack) settles first.
  setTimeout(run, 15_000).unref();
  setInterval(run, DAY_MS).unref();
}
