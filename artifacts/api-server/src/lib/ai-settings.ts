import { db } from "@workspace/db";
import { aiSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
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

// Model families Google has retired ("gemini-pro", 1.0, 1.5 and 2.0-flash).
// Requests to them fail with 404 NOT_FOUND, which used to surface to students
// as a generic "AI error". A stale name can linger in the ai_settings row or
// in a GEMINI_MODEL env var of an older deployment, so remap it at the last
// moment instead of trusting either source.
const RETIRED_MODEL_RE = /^(models\/)?gemini-(pro|1\.[05]|2\.0-flash)/i;
export const FALLBACK_AI_MODEL = "gemini-2.5-flash";

// The model actually sent to Gemini: the admin override when set, otherwise the
// environment default. Keeps a blank "model" field meaning "use env default".
// Retired models are silently upgraded to FALLBACK_AI_MODEL so the feature
// keeps working even with an outdated configuration.
export function resolveAiModel(settings: AiSettingsValue): string {
  const candidate = settings.model.trim() || config.gemini.model;
  return RETIRED_MODEL_RE.test(candidate) ? FALLBACK_AI_MODEL : candidate;
}
