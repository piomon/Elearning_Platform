import { Router } from "express";
import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { tasks, topics, aiChecks, learningProgress } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { z } from "zod/v4";
import type { GenerateContentResult, GenerationConfig } from "@google/generative-ai";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { aiLimiter } from "../middlewares/rate-limit";
import {
  requireCourseAccess,
  requireTopicAccessOrPreview,
  getCourseIdByTaskId,
  getTopicLocation,
  isTopicPublished,
} from "../lib/access";
import { config, isGeminiConfigured } from "../config/env";
import {
  getAiSettings,
  resolveAiModel,
  FALLBACK_AI_MODEL,
  OVERLOAD_FALLBACK_AI_MODEL,
} from "../lib/ai-settings";
import {
  AI_PROFILES,
  AiCallFailure,
  AiOperationAborted,
  callGeminiWithRetry,
  isModelUnavailable,
  isTransientGeminiError,
  mapGeminiError,
  type AiAttemptLog,
  type AiCallOutcome,
  type AiProgressUpdate,
  type AiRetryProfile,
} from "../lib/gemini";
import {
  beginAiProgress,
  updateAiProgress,
  finishAiProgress,
  readAiProgress,
  isValidRequestId,
} from "../lib/ai-progress";
import { recordAiUsage, extractUsage, type RecordAiUsageInput } from "../lib/ai-usage";
import { saveAiCheckImage } from "../lib/ai-check-storage";
import {
  buildChatContext,
  trimHistory,
  resolveChatModel,
  CHAT_MAX_OUTPUT_TOKENS,
} from "../lib/ai-chat";

const router = Router();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB decoded
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g);base64,(.+)$/i;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const DAILY_AI_CHECK_LIMIT = 30;

type ImageValidation =
  | { ok: true; mimeType: string; data: string; sizeBytes: number }
  | { ok: false; status: number; error: string };

// Stricter, dedicated validation path for AI image uploads: enforce an allowed
// image format and a decoded-size cap independent of the global body limit.
function validateImageUpload(input: unknown): ImageValidation {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, status: 400, error: "imageBase64 jest wymagane" };
  }
  const match = input.match(IMAGE_DATA_URL_RE);
  if (!match) {
    return {
      ok: false,
      status: 400,
      error: "Nieobsługiwany format obrazu. Dozwolone: PNG, JPEG.",
    };
  }
  const ext = match[1].toLowerCase();
  const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  const raw = match[2];
  if (!BASE64_RE.test(raw)) {
    return { ok: false, status: 400, error: "Nieprawidłowe dane obrazu" };
  }
  const padding = raw.endsWith("==") ? 2 : raw.endsWith("=") ? 1 : 0;
  const sizeBytes = Math.floor((raw.length * 3) / 4) - padding;
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, error: "Obraz jest zbyt duży (maks. 5 MB)" };
  }
  return { ok: true, mimeType, data: raw, sizeBytes };
}

// Hidden global system prompt. Never returned to the client.
const SYSTEM_PROMPT = `Jesteś pomocnym nauczycielem fizyki. Oceniasz rozwiązanie ucznia klasy 7. 
Odpowiedz po polsku, krótko i przyjaźnie. 
- Wskaż co jest dobrze zrobione
- Wskaż co można poprawić (jeśli coś wymaga poprawy)
- Nie wyśmiewaj ucznia
- Używaj prostego języka dla ucznia 7. klasy
- Bądź konkretny i pomocny
- Odpowiedź powinna być max 3-4 zdania
- Pisz zwykłym tekstem, bez notacji LaTeX i Markdown (żadnych $...$, \\cdot, \\text, gwiazdek). Wzory zapisuj jak w zeszycie, np. Fc = m · g, wynik: 50 N`;

// Per-task overrides stored by the admin. Only a string `systemPrompt` is
// honored; anything else is ignored. The merged prompt stays server-side.
function buildSystemPrompt(aiPromptConfig: unknown): string {
  if (
    aiPromptConfig &&
    typeof aiPromptConfig === "object" &&
    typeof (aiPromptConfig as { systemPrompt?: unknown }).systemPrompt === "string"
  ) {
    const extra = (aiPromptConfig as { systemPrompt: string }).systemPrompt.trim();
    if (extra) {
      return `${SYSTEM_PROMPT}\n\nDodatkowe wskazówki do tego zadania:\n${extra}`;
    }
  }
  return SYSTEM_PROMPT;
}

// A blocked/filtered response makes .text() throw — treat it as empty instead
// of bubbling a cryptic SDK error to the student.
function safeResponseText(result: GenerateContentResult): string {
  try {
    return result.response.text();
  } catch {
    return "";
  }
}

// Vision check: quality first — no thinking-budget cut and no output cap (a
// cap could truncate the feedback mid-sentence when the model "thinks" long).
// Cost control for this path is the daily per-user limit, not token limits.
async function checkWithGemini(
  imageData: string,
  mimeType: string,
  taskDescription: string,
  systemPrompt: string,
  modelName: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<GenerateContentResult> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey as string);
  const model = genAI.getGenerativeModel({ model: modelName }, { timeout: timeoutMs });

  return model.generateContent(
    [
      systemPrompt,
      `Treść zadania: ${taskDescription}`,
      {
        inlineData: {
          data: imageData,
          mimeType,
        },
      },
      "Oceń to rozwiązanie ucznia:",
    ],
    { timeout: timeoutMs, signal },
  );
}

// ─── STUDENT WHITEBOARD CHECK ────────────────────────────────────────────────

router.post(
  "/ai/check",
  requireAuth as any,
  requireCourseAccess((req) => getCourseIdByTaskId(Number(req.body?.taskId))) as any,
  aiLimiter,
  async (req: AuthRequest, res) => {
    const startedAt = Date.now();
    const userId = req.user!.id;
    try {
      const { imageBase64 } = req.body;
      const taskId = Number(req.body?.taskId);
      if (!Number.isInteger(taskId) || taskId <= 0) {
        res.status(400).json({ error: "taskId jest wymagane" });
        return;
      }
      // Optional client-generated id for live retry progress (see /ai/progress).
      const requestId = isValidRequestId(req.body?.requestId) ? req.body.requestId : null;

      const image = validateImageUpload(imageBase64);
      if (!image.ok) {
        res.status(image.status).json({ error: image.error });
        return;
      }

      const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (!task) {
        res.status(404).json({ error: "Zadanie nie znalezione" });
        return;
      }
      // Tasks carry no status of their own; a task is student-visible only when
      // its topic/section/course chain is published.
      if (!(await isTopicPublished(task.topicId))) {
        res.status(404).json({ error: "Zadanie nie znalezione" });
        return;
      }

      // AI must be enabled both globally (aiSettings) and for this lesson.
      const aiCfg = await getAiSettings();
      const [topicRow] = await db
        .select({ aiEnabled: topics.aiEnabled })
        .from(topics)
        .where(eq(topics.id, task.topicId))
        .limit(1);
      if (!aiCfg.enabled || !(topicRow?.aiEnabled ?? true)) {
        res.status(403).json({
          error: aiCfg.errorMessage || "Sprawdzanie AI jest wyłączone dla tej lekcji.",
        });
        return;
      }

      // Per-user daily limit (independent of the IP burst limiter).
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [{ used }] = await db
        .select({ used: sql<number>`count(*)::int` })
        .from(aiChecks)
        .where(
          and(
            eq(aiChecks.userId, userId),
            gte(aiChecks.createdAt, startOfDay),
          ),
        );
      if (used >= DAILY_AI_CHECK_LIMIT) {
        res.status(429).json({
          error: `Wykorzystano dzienny limit sprawdzeń AI (${DAILY_AI_CHECK_LIMIT}). Spróbuj ponownie jutro.`,
        });
        return;
      }

      let model = isGeminiConfigured() ? resolveAiModel(aiCfg) : "demo";

      // Layer the global admin-configured guidance (extra system prompt, eval
      // instruction, tone) on top of the per-task prompt. All stays server-side.
      const globalExtras = [
        aiCfg.systemPrompt.trim(),
        aiCfg.evalInstruction.trim(),
        aiCfg.tone.trim() ? `Ton wypowiedzi: ${aiCfg.tone.trim()}` : "",
        aiCfg.maxResponseLength > 0
          ? `Ogranicz odpowiedź do około ${aiCfg.maxResponseLength} znaków.`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      const composedPrompt = globalExtras
        ? `${buildSystemPrompt(task.aiPromptConfig)}\n\n${globalExtras}`
        : buildSystemPrompt(task.aiPromptConfig);

      // Persist the student's photo up front so BOTH outcomes (completed and
      // failed) keep it — the admin log needs the image precisely when the AI
      // stumbled. Best-effort: a storage failure only loses the preview.
      const imageStoragePath = await saveAiCheckImage(image.data, image.mimeType, req.log);

      const logCheck = async (
        status: "completed" | "failed",
        fields: { aiResponse?: string; errorMessage?: string },
      ) =>
        db
          .insert(aiChecks)
          .values({
            userId,
            taskId,
            topicId: task.topicId,
            model,
            imageStoragePath,
            requestBytes: image.sizeBytes,
            latencyMs: Date.now() - startedAt,
            status,
            aiResponse: fields.aiResponse ?? null,
            errorMessage: fields.errorMessage ?? null,
          })
          .returning();

      let feedback: string;
      // Success-path usage is recorded only AFTER the completed ai_checks row
      // exists, so the ai_usage_log row can reference it (aiCheckId) and the
      // admin log can show photo size + stored response. Stays null in demo
      // mode — there is no real Gemini call to account for.
      let pendingUsage: RecordAiUsageInput | null = null;
      if (!isGeminiConfigured()) {
        if (config.isProd) {
          await logCheck("failed", { errorMessage: "Gemini not configured" });
          res.status(503).json({
            error: "Sprawdzanie AI jest chwilowo niedostępne. Spróbuj ponownie później.",
          });
          return;
        }
        feedback =
          "Sprawdzanie AI działa w trybie demonstracyjnym. Skonfiguruj GEMINI_API_KEY, aby włączyć prawdziwe sprawdzanie. Twoje rozwiązanie wygląda na staranne!";
      } else {
        // Cancel retries/waits the moment the student's connection goes away.
        const abortController = new AbortController();
        res.on("close", () => {
          if (!res.writableEnded) abortController.abort();
        });
        if (requestId) beginAiProgress(requestId, userId, "check", AI_PROFILES.check.maxAttempts);
        const onAttempt = requestId
          ? (u: AiProgressUpdate) => updateAiProgress(requestId, u)
          : undefined;
        // Concurrent duplicates (double-click, second tab) of the SAME drawing
        // for the SAME task share one upstream call instead of multiplying it.
        const imageHash = createHash("sha256").update(image.data).digest("hex").slice(0, 16);

        const runModel = (modelName: string, profile?: Partial<AiRetryProfile>) =>
          callGeminiWithRetry<GenerateContentResult>({
            operation: "check",
            profile,
            signal: abortController.signal,
            dedupeKey: `check:${userId}:${taskId}:${imageHash}`,
            onAttempt,
            log: req.log,
            fn: ({ timeoutMs, signal }) =>
              checkWithGemini(
                image.data,
                image.mimeType,
                task.description ?? task.title,
                composedPrompt,
                modelName,
                timeoutMs,
                signal,
              ),
          });

        // Attempts from an exhausted model run are pushed here ONLY when we
        // chain to another model — a terminal error keeps carrying its own
        // attemptLog to the outer catch, which appends it there. Pushing AND
        // rethrowing the same error would double-count attempts in the stats.
        // Logs shared from a deduped in-flight call stay out entirely: their
        // accounting owner already records them.
        const earlierAttempts: AiAttemptLog[] = [];
        const chainAttempts = (err: unknown) => {
          if (err instanceof AiCallFailure && !err.sharedFromDedupe) {
            earlierAttempts.push(...err.attemptLog);
          }
        };

        // Last-resort rescue for peak-hour overload: when a model exhausts its
        // FULL retry loop on a transient error (429/5xx/timeout), try ONCE on
        // the Flash-Lite alias — a separate capacity pool that is usually
        // still free while the main Flash model is saturated. A single
        // attempt, not a second marathon: the student has already waited out
        // one retry loop. Deliberately absent from the admin model test
        // (there the true error is the point) and from the chat route
        // (already on the lite model).
        const rescueOnOverload = async (
          err: unknown,
        ): Promise<AiCallOutcome<GenerateContentResult>> => {
          if (
            err instanceof AiOperationAborted ||
            !isTransientGeminiError(err) ||
            model === OVERLOAD_FALLBACK_AI_MODEL
          ) {
            throw err;
          }
          chainAttempts(err);
          req.log.warn(
            { model, err },
            "Gemini overloaded after full retry loop — one rescue attempt on the lite model",
          );
          model = OVERLOAD_FALLBACK_AI_MODEL;
          return runModel(model, { maxAttempts: 1 });
        };

        let outcome: AiCallOutcome<GenerateContentResult>;
        try {
          try {
            outcome = await runModel(model);
          } catch (aiErr) {
            if (aiErr instanceof AiOperationAborted) throw aiErr;
            // Self-healing: when Google rejects the configured model NAME
            // (retired or gated — exactly how gemini-1.5-flash broke this
            // feature in production), redo the full retry loop on the rolling
            // fallback alias. This is the ONLY 4xx that gets a second model;
            // plain retry never touches 4xx. Transient errors fall through to
            // the single-shot overload rescue instead.
            if (isModelUnavailable(aiErr) && model !== FALLBACK_AI_MODEL) {
              chainAttempts(aiErr);
              req.log.warn(
                { model, err: aiErr },
                "Gemini model unavailable — retrying with fallback model",
              );
              model = FALLBACK_AI_MODEL;
              try {
                outcome = await runModel(model);
              } catch (fallbackErr) {
                if (fallbackErr instanceof AiOperationAborted) throw fallbackErr;
                outcome = await rescueOnOverload(fallbackErr);
              }
            } else {
              outcome = await rescueOnOverload(aiErr);
            }
          }
        } catch (aiErr) {
          if (requestId) finishAiProgress(requestId, "failed");
          if (aiErr instanceof AiOperationAborted) {
            req.log.info("AI check cancelled — client disconnected");
            await logCheck("failed", { errorMessage: "Przerwane przez klienta" });
            res.status(499).end();
            return;
          }
          const attemptLog =
            aiErr instanceof AiCallFailure
              ? [...earlierAttempts, ...aiErr.attemptLog]
              : earlierAttempts;
          req.log.error({ err: aiErr, attempts: attemptLog.length }, "Gemini check failed");
          const failStatus = aiErr instanceof AiCallFailure ? aiErr.cause : aiErr;
          // The failed ai_checks row goes in first so the usage row can point
          // at it (photo size + task context for the admin log).
          const [failedCheck] = await logCheck("failed", {
            errorMessage: aiErr instanceof Error ? aiErr.message : "Unknown AI error",
          });
          // A failure shared from a deduped in-flight call was already logged
          // by its accounting owner — a second row would inflate failure stats.
          if (!(aiErr instanceof AiCallFailure && aiErr.sharedFromDedupe)) {
            await recordAiUsage({
              userId,
              aiCheckId: failedCheck.id,
              operation: "check",
              model,
              status: "failed",
              httpStatus:
                typeof (failStatus as { status?: unknown })?.status === "number"
                  ? ((failStatus as { status: number }).status)
                  : undefined,
              attemptLog,
              latencyMs: Date.now() - startedAt,
              errorMessage: aiErr instanceof Error ? aiErr.message : "Unknown AI error",
            });
          }
          const mapped = mapGeminiError(
            aiErr,
            "Wystąpił błąd podczas sprawdzania przez AI. Spróbuj ponownie.",
          );
          res.status(mapped.status).json({ error: mapped.error });
          return;
        }

        const combinedLog = [...earlierAttempts, ...outcome.attemptLog];
        feedback = safeResponseText(outcome.value);
        const usage = extractUsage(outcome.value.response);
        // A blocked or truncated response can come back technically "OK" but
        // with no text — treat it as a failure instead of showing an empty box.
        const empty = !feedback.trim();
        if (requestId) finishAiProgress(requestId, empty ? "failed" : "done");
        if (empty) {
          req.log.error("Gemini check returned an empty response");
          const [failedCheck] = await logCheck("failed", { errorMessage: "Empty AI response" });
          await recordAiUsage({
            userId,
            aiCheckId: failedCheck.id,
            operation: "check",
            model,
            status: "failed",
            attemptLog: combinedLog,
            usage,
            latencyMs: Date.now() - startedAt,
            errorMessage: "Empty AI response",
            sharedFromDedupe: outcome.sharedFromDedupe,
          });
          res.status(502).json({
            error: "AI nie zwróciło odpowiedzi. Spróbuj ponownie za chwilę.",
          });
          return;
        }
        pendingUsage = {
          userId,
          operation: "check",
          model,
          status: "completed",
          attemptLog: combinedLog,
          usage,
          latencyMs: Date.now() - startedAt,
          sharedFromDedupe: outcome.sharedFromDedupe,
        };
      }

      const [check] = await logCheck("completed", { aiResponse: feedback });
      if (pendingUsage) {
        await recordAiUsage({ ...pendingUsage, aiCheckId: check.id });
      }

      // Upsert: the student may reach the AI check before any progress row was
      // created for this topic, so insert one rather than no-op on a missing row.
      const location = await getTopicLocation(task.topicId);
      if (location) {
        await db
          .insert(learningProgress)
          .values({
            userId,
            courseId: location.courseId,
            sectionId: location.sectionId,
            topicId: task.topicId,
            taskCheckedByAi: true,
          })
          .onConflictDoUpdate({
            target: [learningProgress.userId, learningProgress.topicId],
            set: { taskCheckedByAi: true, updatedAt: new Date() },
          });
      }

      res.json({ feedback, checkId: check.id });
    } catch (err) {
      req.log.error({ err }, "AI check error");
      res.status(500).json({ error: "Błąd serwera" });
    }
  },
);

// ─── LIVE RETRY PROGRESS ─────────────────────────────────────────────────────

// Polled by the frontend while an AI request is in flight, so the student sees
// an honest "Ponawiam próbę 2 z 4…" instead of a mute spinner. Owner-only.
router.get("/ai/progress/:requestId", requireAuth as any, async (req: AuthRequest, res) => {
  const { requestId } = req.params;
  if (!isValidRequestId(requestId)) {
    res.status(400).json({ error: "Nieprawidłowy identyfikator zapytania" });
    return;
  }
  const entry = readAiProgress(requestId, req.user!.id);
  if (!entry) {
    res.status(404).json({ error: "Nie znaleziono zapytania" });
    return;
  }
  res.json({
    phase: entry.phase,
    attempt: entry.attempt,
    maxAttempts: entry.maxAttempts,
    operation: entry.operation,
  });
});

// ─── PER-LESSON AI CHAT ──────────────────────────────────────────────────────

const MAX_CHAT_MESSAGE = 2000;
const MAX_HISTORY = 12;

const lessonChatSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(MAX_CHAT_MESSAGE),
      }),
    )
    .max(MAX_HISTORY)
    .optional(),
  requestId: z.string().max(64).optional(),
});

// Text assistant: cost first — economical model, short system prompt, trimmed
// history (see lib/ai-chat.ts), capped output and no paid "thinking" tokens.
async function chatWithGemini(
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  message: string,
  modelName: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<GenerateContentResult> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey as string);
  const generationConfig = {
    maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
    // The SDK's types predate thinking control; the REST API accepts it and it
    // removes billed reasoning tokens from simple text replies.
    ...({ thinkingConfig: { thinkingBudget: 0 } } as Record<string, unknown>),
  } as GenerationConfig;
  const model = genAI.getGenerativeModel(
    {
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig,
    },
    { timeout: timeoutMs },
  );

  const chat = model.startChat({
    history: history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });
  return chat.sendMessage(message, { timeout: timeoutMs, signal });
}

router.post(
  "/ai/lesson-chat",
  requireAuth as any,
  requireTopicAccessOrPreview("topicId") as any,
  aiLimiter,
  async (req: AuthRequest, res) => {
    const startedAt = Date.now();
    try {
      const parsed = lessonChatSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Nieprawidłowe dane", details: parsed.error.issues });
        return;
      }
      const { topicId, message, history } = parsed.data;
      const requestId = isValidRequestId(parsed.data.requestId) ? parsed.data.requestId : null;
      const userId = req.user!.id;

      const [topic] = await db
        .select({ title: topics.title, description: topics.description, aiEnabled: topics.aiEnabled })
        .from(topics)
        .where(eq(topics.id, topicId))
        .limit(1);
      // A draft/hidden/archived lesson (or one under a non-published parent) has
      // no AI tutor — even for a user who has access to the course.
      if (!topic || !(await isTopicPublished(topicId))) {
        res.status(404).json({ error: "Temat nie znaleziony" });
        return;
      }

      // AI must be enabled both globally and for this specific lesson.
      const aiCfg = await getAiSettings();
      if (!aiCfg.enabled || !(topic.aiEnabled ?? true)) {
        res.status(403).json({
          error: aiCfg.errorMessage || "Asystent AI jest wyłączony dla tej lekcji.",
        });
        return;
      }

      if (!isGeminiConfigured()) {
        if (config.isProd) {
          res.status(503).json({
            error: "Asystent AI jest chwilowo niedostępny. Spróbuj ponownie później.",
          });
          return;
        }
        res.json({
          reply:
            "Asystent AI działa w trybie demonstracyjnym. Skonfiguruj GEMINI_API_KEY, aby włączyć prawdziwe rozmowy. To jest przykładowa odpowiedź.",
        });
        return;
      }

      // Compact context: short system prompt + clipped lesson intro + only the
      // last few (clipped) turns. This is where the ~10× token cut comes from.
      const contextPrompt = buildChatContext(topic.title, topic.description);
      const trimmedHistory = trimHistory(history ?? []);

      const abortController = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) abortController.abort();
      });
      if (requestId) beginAiProgress(requestId, userId, "chat", AI_PROFILES.chat.maxAttempts);
      const onAttempt = requestId
        ? (u: AiProgressUpdate) => updateAiProgress(requestId, u)
        : undefined;
      const contentHash = createHash("sha256")
        .update(JSON.stringify([topicId, message, trimmedHistory]))
        .digest("hex")
        .slice(0, 16);

      let chatModel = resolveChatModel();
      const runModel = (modelName: string) =>
        callGeminiWithRetry<GenerateContentResult>({
          operation: "chat",
          signal: abortController.signal,
          dedupeKey: `chat:${userId}:${contentHash}`,
          onAttempt,
          log: req.log,
          fn: ({ timeoutMs, signal }) =>
            chatWithGemini(contextPrompt, trimmedHistory, message, modelName, timeoutMs, signal),
        });

      const earlierAttempts: AiAttemptLog[] = [];
      let outcome: AiCallOutcome<GenerateContentResult>;
      try {
        try {
          outcome = await runModel(chatModel);
        } catch (aiErr) {
          if (aiErr instanceof AiCallFailure) earlierAttempts.push(...aiErr.attemptLog);
          // Same self-healing as the task check: a rejected model name is
          // retried once with the rolling fallback alias.
          if (
            aiErr instanceof AiOperationAborted ||
            !isModelUnavailable(aiErr) ||
            chatModel === FALLBACK_AI_MODEL
          ) {
            throw aiErr;
          }
          req.log.warn(
            { model: chatModel, err: aiErr },
            "Gemini model unavailable — retrying with fallback model",
          );
          chatModel = FALLBACK_AI_MODEL;
          outcome = await runModel(chatModel);
        }
      } catch (aiErr) {
        if (requestId) finishAiProgress(requestId, "failed");
        if (aiErr instanceof AiOperationAborted) {
          req.log.info("Lesson chat cancelled — client disconnected");
          res.status(499).end();
          return;
        }
        const attemptLog =
          aiErr instanceof AiCallFailure
            ? [...earlierAttempts, ...aiErr.attemptLog]
            : earlierAttempts;
        req.log.error({ err: aiErr, attempts: attemptLog.length }, "Gemini lesson chat failed");
        const failCause = aiErr instanceof AiCallFailure ? aiErr.cause : aiErr;
        // A shared deduped failure is logged only by its accounting owner.
        if (!(aiErr instanceof AiCallFailure && aiErr.sharedFromDedupe)) {
          await recordAiUsage({
            userId,
            operation: "chat",
            model: chatModel,
            status: "failed",
            httpStatus:
              typeof (failCause as { status?: unknown })?.status === "number"
                ? ((failCause as { status: number }).status)
                : undefined,
            attemptLog,
            latencyMs: Date.now() - startedAt,
            errorMessage: aiErr instanceof Error ? aiErr.message : "Unknown AI error",
          });
        }
        const mapped = mapGeminiError(
          aiErr,
          "Wystąpił błąd podczas rozmowy z AI. Spróbuj ponownie za chwilę.",
        );
        res.status(mapped.status).json({ error: mapped.error });
        return;
      }

      const reply = safeResponseText(outcome.value);
      const usage = extractUsage(outcome.value.response);
      const empty = !reply.trim();
      if (requestId) finishAiProgress(requestId, empty ? "failed" : "done");
      await recordAiUsage({
        userId,
        operation: "chat",
        model: chatModel,
        status: empty ? "failed" : "completed",
        attemptLog: [...earlierAttempts, ...outcome.attemptLog],
        usage,
        latencyMs: Date.now() - startedAt,
        errorMessage: empty ? "Empty AI response" : undefined,
        sharedFromDedupe: outcome.sharedFromDedupe,
      });
      if (empty) {
        req.log.error("Gemini lesson chat returned an empty response");
        res.status(502).json({
          error: "AI nie zwróciło odpowiedzi. Spróbuj ponownie za chwilę.",
        });
        return;
      }
      res.json({ reply });
    } catch (err) {
      req.log.error({ err }, "Lesson chat error");
      res.status(500).json({ error: "Błąd serwera" });
    }
  },
);

export default router;
