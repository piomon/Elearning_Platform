// Shared plumbing for Gemini calls: a hard per-request timeout plus a
// translator from upstream failures to honest Polish user messages.
//
// The timeout guarantees a student never stares at an endless spinner — the
// SDK aborts the HTTP request and the route returns a clear 504. 55 s stays
// under typical 60 s proxy limits while leaving room for slow vision answers.
export const GEMINI_TIMEOUT_MS = 55_000;

export type MappedGeminiError = { status: number; error: string };

// True when Gemini rejected the model name itself (retired, gated for new
// users, or misspelled) — the one failure that retrying with a different
// model can fix. The SDK surfaces the upstream HTTP status on the error.
export function isModelUnavailable(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 404;
}

// Distinguish the causes a student (or admin) can actually act on instead of
// collapsing everything into one generic error. The technical detail is logged
// server-side by the caller; the returned message is safe to show users.
export function mapGeminiError(
  err: unknown,
  fallback: string,
): MappedGeminiError {
  const status = (err as { status?: number } | null)?.status;
  const message = err instanceof Error ? err.message : String(err ?? "");

  // Quota / rate limit on the Google account — retrying later genuinely helps.
  if (status === 429) {
    return {
      status: 503,
      error:
        "AI jest chwilowo przeciążone (limit zapytań). Odczekaj minutę i spróbuj ponownie.",
    };
  }
  // Unknown or retired model name — the student cannot fix this; say clearly
  // that it's a configuration problem instead of blaming their solution.
  if (status === 404) {
    return {
      status: 502,
      error:
        "Sprawdzanie AI jest chwilowo niedostępne (błąd konfiguracji modelu AI). Zgłoś problem przez formularz kontaktowy.",
    };
  }
  // Invalid/blocked API key or permission problem.
  if (status === 401 || status === 403) {
    return {
      status: 502,
      error:
        "Sprawdzanie AI jest chwilowo niedostępne (błąd konfiguracji klucza AI). Zgłoś problem przez formularz kontaktowy.",
    };
  }
  // Our timeout above (the SDK aborts the fetch) or an upstream deadline.
  if (/abort|timeout|timed out|deadline/i.test(message)) {
    return {
      status: 504,
      error:
        "Sprawdzanie trwało zbyt długo. Twoje rozwiązanie zostało na tablicy — spróbuj ponownie.",
    };
  }
  return { status: 502, error: fallback };
}
