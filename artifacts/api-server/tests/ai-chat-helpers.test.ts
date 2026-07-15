import { describe, it, expect } from "vitest";
import {
  CHAT_SYSTEM_PROMPT,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_MESSAGE_CHARS,
  MAX_CONTEXT_DESCRIPTION_CHARS,
  trimHistory,
  buildChatContext,
  resolveChatModel,
  DEFAULT_CHAT_MODEL,
} from "../src/lib/ai-chat";
import { guardRetiredModel } from "../src/lib/ai-settings";

// Cost-cut guarantees for the text assistant (brief §"Optymalizacja kosztów"):
// short system prompt, bounded history, clipped context, cheap default model.
describe("AI chat cost controls", () => {
  it("keeps the chat system prompt short (vs the old ~900-char prompt)", () => {
    expect(CHAT_SYSTEM_PROMPT.length).toBeLessThan(500);
    // Sanity: it still carries the guardrails in Polish.
    expect(CHAT_SYSTEM_PROMPT).toMatch(/fizyki/i);
  });

  it("trims history to the last N messages and clips each one", () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `wiadomość ${i} ${"x".repeat(2_000)}`,
    }));
    const trimmed = trimHistory(history);
    expect(trimmed).toHaveLength(MAX_HISTORY_MESSAGES);
    // Keeps the NEWEST messages.
    expect(trimmed[trimmed.length - 1].content.startsWith("wiadomość 11")).toBe(true);
    for (const m of trimmed) {
      expect(m.content.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGE_CHARS + 1); // +1 for ellipsis
    }
  });

  it("passes short histories through untouched", () => {
    const history = [
      { role: "user" as const, content: "Czym jest siła?" },
      { role: "assistant" as const, content: "Siła to oddziaływanie." },
    ];
    expect(trimHistory(history)).toEqual(history);
  });

  it("clips the lesson description in the chat context", () => {
    const ctx = buildChatContext("Kinematyka", "opis ".repeat(500));
    expect(ctx).toContain("Kinematyka");
    expect(ctx).toContain("…"); // description got clipped
    // Context = short system prompt + lesson line with the clipped description.
    expect(ctx.length).toBeLessThan(
      CHAT_SYSTEM_PROMPT.length + MAX_CONTEXT_DESCRIPTION_CHARS + 50,
    );
  });

  it("handles a missing description", () => {
    const ctx = buildChatContext("Dynamika", null);
    expect(ctx).toContain("Dynamika");
  });

  it("defaults to the cheap flash-lite model for chat", () => {
    // setup.ts deletes GEMINI_CHAT_MODEL, so the default applies.
    expect(resolveChatModel()).toBe(DEFAULT_CHAT_MODEL);
    expect(DEFAULT_CHAT_MODEL).toContain("flash-lite");
  });

  it("never resolves a retired model", () => {
    expect(guardRetiredModel("gemini-1.5-flash", "gemini-flash-lite-latest")).toBe(
      "gemini-flash-lite-latest",
    );
    expect(guardRetiredModel("gemini-flash-latest", "x")).toBe("gemini-flash-latest");
  });
});
