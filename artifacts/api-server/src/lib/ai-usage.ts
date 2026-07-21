// Diagnostics and cost accounting for every Gemini call (brief §4 i §10):
// one ai_usage_log row per finished operation — attempts, retry reasons,
// token counts and an estimated cost — plus a structured server log line per
// call. NEVER stores API keys, full prompts or private student content; the
// error message is sanitized and truncated.

import { db, aiUsageLog } from "@workspace/db";
import { config } from "../config/env";
import { logger } from "./logger";
import type { AiAttemptLog, AiOperation } from "./gemini";

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

// Token usage as reported by Gemini. "Thinking" tokens (thoughtsTokenCount)
// are billed at the output rate, so they are folded into outputTokens — the
// stored number is what the answer actually cost, not just its visible text.
export function extractUsage(response: unknown): AiUsage {
  const meta = (response as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata;
  if (!meta || typeof meta !== "object") return {};
  const num = (key: string): number | undefined => {
    const value = meta[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  };
  const candidates = num("candidatesTokenCount") ?? 0;
  const thoughts = num("thoughtsTokenCount") ?? 0;
  const output = candidates + thoughts;
  return {
    inputTokens: num("promptTokenCount"),
    outputTokens: output > 0 || num("candidatesTokenCount") !== undefined ? output : undefined,
    totalTokens: num("totalTokenCount"),
  };
}

// Gemini price list, USD per 1M tokens (July 2026). Estimates only — the
// authoritative bill is Google's; AI_USD_PLN_RATE adjusts the currency.
// Order matters: first match wins, so the more specific "flash-lite" comes
// before "flash".
const PRICING_USD_PER_MTOK: Array<{ match: RegExp; input: number; output: number }> = [
  { match: /flash-lite/i, input: 0.1, output: 0.4 },
  { match: /flash/i, input: 0.3, output: 2.5 },
  { match: /pro/i, input: 1.25, output: 10 },
];

const DEFAULT_PRICING = { input: 0.3, output: 2.5 };

/** Estimated cost in grosze (0.01 PLN), or null when tokens are unknown. */
export function estimateCostGrosz(
  model: string,
  inputTokens?: number,
  outputTokens?: number,
): number | null {
  if (inputTokens === undefined && outputTokens === undefined) return null;
  const pricing =
    PRICING_USD_PER_MTOK.find((p) => p.match.test(model)) ?? DEFAULT_PRICING;
  const usd =
    ((inputTokens ?? 0) / 1_000_000) * pricing.input +
    ((outputTokens ?? 0) / 1_000_000) * pricing.output;
  return usd * config.ai.usdPlnRate * 100;
}

// Strip anything that could smuggle a credential into the log (defense in
// depth — the SDK sends the key in a header, not the URL) and cap length.
export function sanitizeAiError(message: string): string {
  return message
    .replace(/([?&]key=)[^&\s"']+/gi, "$1***")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1***")
    .slice(0, 500);
}

export interface RecordAiUsageInput {
  userId: number | null;
  /** For "check" operations: the ai_checks row this call produced, so the
   * admin log can show photo size, stored response and task context. */
  aiCheckId?: number | null;
  operation: AiOperation;
  model: string;
  status: "completed" | "failed";
  httpStatus?: number;
  attemptLog: AiAttemptLog[];
  usage?: AiUsage;
  latencyMs: number;
  errorMessage?: string;
  /** Outcome shared from an identical in-flight call — Google billed it once,
   * so log it once (skip). */
  sharedFromDedupe?: boolean;
}

// Fire-and-forget: diagnostics must never break the student-facing flow.
export async function recordAiUsage(input: RecordAiUsageInput): Promise<void> {
  if (input.sharedFromDedupe) return;
  const attempts = Math.max(input.attemptLog.length, 1);
  const rescuedByRetry = input.status === "completed" && attempts > 1;
  const transient429 = input.attemptLog.filter((a) => a.httpStatus === 429).length;
  const transient503 = input.attemptLog.filter((a) => a.httpStatus === 503).length;
  const cost = estimateCostGrosz(input.model, input.usage?.inputTokens, input.usage?.outputTokens);

  // Brief §4: every call leaves a structured, greppable trace with operation,
  // model, attempts, statuses, latency, tokens and cost — and no secrets.
  logger.info(
    {
      aiUsage: {
        operation: input.operation,
        model: input.model,
        status: input.status,
        httpStatus: input.httpStatus,
        attempts,
        rescuedByRetry,
        attemptLog: input.attemptLog,
        inputTokens: input.usage?.inputTokens,
        outputTokens: input.usage?.outputTokens,
        estCostGrosz: cost !== null ? Number(cost.toFixed(4)) : undefined,
        latencyMs: input.latencyMs,
      },
    },
    "AI usage",
  );

  try {
    await db.insert(aiUsageLog).values({
      userId: input.userId,
      aiCheckId: input.aiCheckId ?? null,
      operation: input.operation,
      model: input.model,
      status: input.status,
      httpStatus: input.httpStatus ?? null,
      attempts,
      rescuedByRetry,
      transient429,
      transient503,
      attemptLog: input.attemptLog,
      inputTokens: input.usage?.inputTokens ?? null,
      outputTokens: input.usage?.outputTokens ?? null,
      totalTokens: input.usage?.totalTokens ?? null,
      estCostGrosz: cost !== null ? cost.toFixed(6) : null,
      latencyMs: input.latencyMs,
      errorMessage: input.errorMessage ? sanitizeAiError(input.errorMessage) : null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to persist ai_usage_log row");
  }
}
