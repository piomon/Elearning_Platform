// Text-assistant configuration (brief §5–§9): a deliberately SHORT system
// prompt, a trimmed conversation context and an economical model. The
// assistant is the high-volume simple path — it gets minimal tokens; the
// whiteboard check keeps the richer prompt and stronger model (see
// routes/ai.ts). Do not reuse the check prompt here or vice versa.

import { config } from "../config/env";
import { guardRetiredModel } from "./ai-settings";

// ~15% of the previous system+rules prompt. Keeps: role, language, style,
// no-ready-answers rule, plain-text/no-LaTeX rule, honesty rule, off-topic
// rule. Everything else was repetition the model didn't need.
export const CHAT_SYSTEM_PROMPT =
  "Jesteś korepetytorem fizyki dla ucznia klasy 7 w Polsce. Odpowiadaj po polsku, prosto i konkretnie, maksymalnie 5 zdań. " +
  "Naprowadzaj ucznia, nie podawaj gotowych rozwiązań zadań. Pisz zwykłym tekstem bez LaTeX i Markdown, wzory jak w zeszycie (np. Fc = m · g). " +
  "Nie wymyślaj informacji — gdy czegoś brakuje, napisz czego. Przy pytaniach spoza fizyki krótko wróć do tematu lekcji.";

// Context policy (brief §7): only the last few messages matter for a short
// tutoring exchange; older turns are dropped instead of re-billed on every
// request, and any single oversized message is clipped.
export const MAX_HISTORY_MESSAGES = 6;
export const MAX_HISTORY_MESSAGE_CHARS = 600;
export const MAX_CONTEXT_DESCRIPTION_CHARS = 280;
// Hard cap on the reply size (brief §7) — 5 sentences fit comfortably.
export const CHAT_MAX_OUTPUT_TOKENS = 512;

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export function trimHistory(history: ChatHistoryMessage[]): ChatHistoryMessage[] {
  return history.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role,
    content:
      message.content.length > MAX_HISTORY_MESSAGE_CHARS
        ? `${message.content.slice(0, MAX_HISTORY_MESSAGE_CHARS)}…`
        : message.content,
  }));
}

// Lesson context: title always, description clipped — enough to anchor the
// tutor to the lesson without re-sending whole lesson texts every turn.
export function buildChatContext(topicTitle: string, description?: string | null): string {
  const trimmed = (description ?? "").trim();
  const shortDescription =
    trimmed.length > MAX_CONTEXT_DESCRIPTION_CHARS
      ? `${trimmed.slice(0, MAX_CONTEXT_DESCRIPTION_CHARS)}…`
      : trimmed;
  return `${CHAT_SYSTEM_PROMPT}\nLekcja: „${topicTitle}”${
    shortDescription ? ` — ${shortDescription}` : ""
  }`;
}

// The assistant uses the cheap model by default (GEMINI_CHAT_MODEL overrides;
// retired names are remapped like everywhere else). Deliberately independent
// from the admin "model" setting, which governs the quality-first whiteboard
// check — see brief §8.
export const DEFAULT_CHAT_MODEL = "gemini-flash-lite-latest";

export function resolveChatModel(): string {
  return guardRetiredModel(config.gemini.chatModel, DEFAULT_CHAT_MODEL);
}
