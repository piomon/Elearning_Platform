---
name: AI overload rescue chain
description: Two-stage Gemini fallback in the check route and the attempt-accounting trap
---

# Two-stage model fallback in the AI check route

- 404 (Google rejected the model NAME) → FULL retry loop on `FALLBACK_AI_MODEL`
  (rolling flash alias). Only 4xx that gets a second model.
- Transient exhaust (429/5xx/timeout after the WHOLE loop) → exactly ONE attempt
  on `OVERLOAD_FALLBACK_AI_MODEL` (flash-lite alias — separate capacity pool
  that usually survives peak-hour Flash saturation).
- Guards: never after abort, never when already on the lite alias; chat and
  admin-test routes deliberately excluded (chat is already lite; admin test must
  show the true error).

**Why:** client saw daytime 503s (Google-side overload). One attempt, not a
second marathon — the student already waited out a full retry loop.

# Attempt-accounting trap (fixed bug — do not reintroduce)

Push an exhausted `AiCallFailure.attemptLog` into `earlierAttempts` ONLY when
chaining onward to another model run. Pushing before a rethrow double-counts:
the outer catch appends `aiErr.attemptLog` again. Dedupe-shared failures must
never be pushed either — their accounting owner records them.

**How to apply:** new fallback stages rethrow terminal errors untouched and call
the chain-attempts helper only on the continue path. `ai-overload-fallback.test.ts`
pins exact-once accounting; for fast retry tests mutate
`AI_PROFILES.check.baseDelaysMs` to `[5,5,5]` per file (vitest isolates module
registries per file, so it cannot leak).
