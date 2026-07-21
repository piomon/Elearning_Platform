import { db } from "@workspace/db";
import { aiSettings, aiChecks, aiUsageLog } from "@workspace/db";
import { and, eq, gt, gte, sql } from "drizzle-orm";
import { config } from "../config/env";

// Global AI configuration is a singleton row (id = 1). The admin edits it in the
// "AI" settings view; the public AI routes read it to decide whether AI is on,
// which model to use and how to shape the prompt. The Gemini API key is NEVER
// stored here — it lives only in the environment — so this object is safe to
// return to the admin client.
export type AiSettingsValue = {
  enabled: boolean;
  model: string;
  systemPrompt: string;
  evalInstruction: string;
  tone: string;
  maxResponseLength: number;
  errorMessage: string;
};

export const DEFAULT_AI_SETTINGS: AiSettingsValue = {
  enabled: true,
  model: "",
  systemPrompt: "",
  evalInstruction: "",
  tone: "",
  maxResponseLength: 0,
  errorMessage: "",
};

export async function getAiSettings(): Promise<AiSettingsValue> {
  const [row] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.id, 1))
    .limit(1);
  if (!row) return { ...DEFAULT_AI_SETTINGS };
  return {
    enabled: row.enabled,
    model: row.model,
    systemPrompt: row.systemPrompt,
    evalInstruction: row.evalInstruction,
    tone: row.tone,
    maxResponseLength: row.maxResponseLength,
    errorMessage: row.errorMessage,
  };
}

// Model families Google has retired or gated for new API users (legacy
// "gemini-pro", 1.0/1.5, 2.0-flash, 2.5-flash). Requests to them fail with
// 404 NOT_FOUND, which used to surface to students as a generic "AI error".
// A stale name can linger in the ai_settings row or in a GEMINI_MODEL env var
// of an older deployment, so remap it at the last moment instead of trusting
// either source. NOTE: "gemini-pro-latest" is a VALID rolling alias — the
// legacy-pro branch must anchor at the end so it is not caught.
const RETIRED_MODEL_RE =
  /^(models\/)?gemini-(pro(-vision)?$|1\.[05]|2\.0-flash|2\.5-flash)/i;
// Google's rolling alias for the newest stable Flash model — never retired,
// unlike pinned names. Used when config points at a dead model.
export const FALLBACK_AI_MODEL = "gemini-flash-latest";

// Rescue pool for peak-hour overload: the Flash-Lite rolling alias runs on a
// separate (higher-limit) capacity pool that is usually still free while the
// main Flash model answers 429/503. Used ONLY after a model exhausts its full
// retry loop on a transient error — see the /ai/check route.
export const OVERLOAD_FALLBACK_AI_MODEL = "gemini-flash-lite-latest";

// The model actually sent to Gemini: the admin override when set, otherwise the
// environment default. Keeps a blank "model" field meaning "use env default".
// Retired models are silently upgraded to FALLBACK_AI_MODEL so the feature
// keeps working even with an outdated configuration.
export function resolveAiModel(settings: AiSettingsValue): string {
  return guardRetiredModel(settings.model.trim() || config.gemini.model, FALLBACK_AI_MODEL);
}

// Same retired-name protection for any other model source (e.g. the chat
// model env var): blank or retired names collapse to the given fallback.
export function guardRetiredModel(candidate: string, fallback: string): string {
  const name = candidate.trim();
  if (!name) return fallback;
  return RETIRED_MODEL_RE.test(name) ? fallback : name;
}

// ─── Fallback-model alert ─────────────────────────────────────────────────────

export type AiFallbackAlert = {
  /** Checks that ran on the fallback model in the last 24 hours. */
  count: number;
  /** ISO timestamp of the most recent one. */
  lastAt: string | null;
  /** The model the configuration points at (admin override or env default). */
  configuredModel: string;
  /** The rolling alias those checks actually ran on. */
  fallbackModel: string;
};

// Tells the admin that the retired-model safety net is doing the work: rows in
// ai_checks from the last 24 h that ran on FALLBACK_AI_MODEL while the
// configuration points elsewhere mean the configured model stopped working —
// either a retired name was remapped up-front (resolveAiModel) or Google
// answered 404 mid-request and the check was redone on the fallback. Both paths
// record the fallback alias as the check's model. Comparing against the RAW
// configured name (not the resolved one) makes the alert disappear the moment
// the admin fixes the configuration, without waiting out the 24 h window.
export async function getFallbackAlert(
  rawConfiguredModel: string,
): Promise<AiFallbackAlert | null> {
  const configured = rawConfiguredModel.trim() || config.gemini.model;
  if (configured === FALLBACK_AI_MODEL) return null;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      lastAt: sql<Date | string | null>`max(${aiChecks.createdAt})`,
    })
    .from(aiChecks)
    .where(and(eq(aiChecks.model, FALLBACK_AI_MODEL), gte(aiChecks.createdAt, since)));
  if (!row || row.count === 0) return null;
  return {
    count: row.count,
    lastAt: row.lastAt ? new Date(row.lastAt).toISOString() : null,
    configuredModel: configured,
    fallbackModel: FALLBACK_AI_MODEL,
  };
}

// ─── Overload-rescue stats ────────────────────────────────────────────────────

export type AiOverloadRescueStats = {
  /** Checks the lite model saved in the last 24 h (completed after chaining). */
  rescued: number;
  /** Checks that still failed even on the lite model. */
  failed: number;
  /** ISO timestamp of the most recent rescue attempt (either outcome). */
  lastAt: string | null;
  /** The rolling alias the rescue runs on. */
  rescueModel: string;
};

// How often the peak-hour overload rescue (one attempt on the Flash-Lite
// alias after a model exhausts its full retry loop on 429/5xx) is doing the
// work — the best signal that Google's daily overloads still reach students.
// A rescue row is an ai_usage_log "check" row whose model is the lite alias
// with attempts > 1: the chained attemptLog from the exhausted model
// guarantees >1, while attempts = 1 means the admin simply configured the
// lite alias as the main model (not a rescue). Returns null when the last
// 24 h are clean, so the indicator disappears the moment overloads stop.
export async function getOverloadRescueStats(): Promise<AiOverloadRescueStats | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      rescued: sql<number>`count(*) filter (where ${aiUsageLog.status} = 'completed')::int`,
      failed: sql<number>`count(*) filter (where ${aiUsageLog.status} = 'failed')::int`,
      lastAt: sql<Date | string | null>`max(${aiUsageLog.createdAt})`,
    })
    .from(aiUsageLog)
    .where(
      and(
        eq(aiUsageLog.operation, "check"),
        eq(aiUsageLog.model, OVERLOAD_FALLBACK_AI_MODEL),
        gt(aiUsageLog.attempts, 1),
        gte(aiUsageLog.createdAt, since),
      ),
    );
  if (!row || row.rescued + row.failed === 0) return null;
  return {
    rescued: row.rescued,
    failed: row.failed,
    lastAt: row.lastAt ? new Date(row.lastAt).toISOString() : null,
    rescueModel: OVERLOAD_FALLBACK_AI_MODEL,
  };
}
