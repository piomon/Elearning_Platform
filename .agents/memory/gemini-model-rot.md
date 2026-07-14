---
name: Gemini model rot & self-healing model resolution
description: Why the AI check broke in production and the three-layer defense against pinned Gemini models dying.
---

# The failure class

Pinned Gemini model names rot: Google retired `gemini-1.5-flash` (broke AI checking in
production with 404), and by mid-2026 `gemini-2.5-flash` is **listed by ListModels but
gated** — generateContent returns `404 "no longer available to new users"` for new API
keys. "Listed ≠ usable": always verify with a real generateContent call, not ListModels.

# The defense (three layers, all must stay)

1. **Default = rolling alias** `gemini-flash-latest` (env.ts `config.gemini.model`,
   docker-compose default, blank `GEMINI_MODEL` in .env.example). Aliases track the
   newest stable Flash and never retire.
2. **`resolveAiModel()` remaps retired families** (legacy `gemini-pro$`/`-vision`, 1.0/1.5,
   2.0-flash, 2.5-flash) to `FALLBACK_AI_MODEL` — protects against stale values in the
   `ai_settings` DB row AND stale `GEMINI_MODEL` env on old VPS deploys. NOTE:
   `gemini-pro-latest` is a VALID alias — the legacy-pro regex branch must anchor `$`.
3. **404 retry-once**: student-facing routes retry with `FALLBACK_AI_MODEL` when the
   configured model 404s (`isModelUnavailable`). The admin test endpoint deliberately
   does NOT retry — admins need the true error for the model they typed.

**Why:** any one layer alone leaves a broken path (stale DB row, stale VPS .env, or a
future retirement of the then-current pin).

**How to apply:** never hardcode a dated Gemini model as a default anywhere (schema
column defaults included — `ai_settings.model` default is now `''` = "use env default").
Admin can still pin explicitly via admin UI or `GEMINI_MODEL`.

# Related plumbing

- Gemini calls carry a 55s timeout (`GEMINI_TIMEOUT_MS`, lib/gemini.ts) so students never
  get an endless spinner; `mapGeminiError` translates 429/404/401/403/timeout into
  specific Polish messages, and the frontend prefers backend `error` text for 429/5xx.
- Empty `response.text()` is treated as a failure (blocked/truncated responses can be
  HTTP-200 with no text).
- `ai_checks` table is the diagnosis goldmine: status/model/error_message/latency per
  attempt.
