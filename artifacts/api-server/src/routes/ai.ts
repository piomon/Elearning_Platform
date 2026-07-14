import { Router } from "express";
import { db } from "@workspace/db";
import { tasks, topics, aiChecks, learningProgress } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { z } from "zod/v4";
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
import { getAiSettings, resolveAiModel, FALLBACK_AI_MODEL } from "../lib/ai-settings";
import { GEMINI_TIMEOUT_MS, isModelUnavailable, mapGeminiError } from "../lib/gemini";

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

async function checkWithGemini(
  imageData: string,
  mimeType: string,
  taskDescription: string,
  systemPrompt: string,
  modelName: string,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey as string);
  const model = genAI.getGenerativeModel(
    { model: modelName },
    { timeout: GEMINI_TIMEOUT_MS },
  );

  const result = await model.generateContent([
    systemPrompt,
    `Treść zadania: ${taskDescription}`,
    {
      inlineData: {
        data: imageData,
        mimeType,
      },
    },
    "Oceń to rozwiązanie ucznia:",
  ]);
  return result.response.text();
}

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
            requestBytes: image.sizeBytes,
            latencyMs: Date.now() - startedAt,
            status,
            aiResponse: fields.aiResponse ?? null,
            errorMessage: fields.errorMessage ?? null,
          })
          .returning();

      let feedback: string;
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
        try {
          try {
            feedback = await checkWithGemini(
              image.data,
              image.mimeType,
              task.description ?? task.title,
              composedPrompt,
              model,
            );
          } catch (aiErr) {
            // Self-healing: when Google rejects the configured model name
            // (retired or gated — exactly how gemini-1.5-flash broke this
            // feature in production), retry once with the rolling fallback
            // alias instead of failing the student.
            if (!isModelUnavailable(aiErr) || model === FALLBACK_AI_MODEL) {
              throw aiErr;
            }
            req.log.warn(
              { model, err: aiErr },
              "Gemini model unavailable — retrying with fallback model",
            );
            model = FALLBACK_AI_MODEL;
            feedback = await checkWithGemini(
              image.data,
              image.mimeType,
              task.description ?? task.title,
              composedPrompt,
              model,
            );
          }
        } catch (aiErr) {
          req.log.error({ err: aiErr }, "Gemini check failed");
          await logCheck("failed", {
            errorMessage: aiErr instanceof Error ? aiErr.message : "Unknown AI error",
          });
          const mapped = mapGeminiError(
            aiErr,
            "Wystąpił błąd podczas sprawdzania przez AI. Spróbuj ponownie.",
          );
          res.status(mapped.status).json({ error: mapped.error });
          return;
        }
        // A blocked or truncated response can come back technically "OK" but
        // with no text — treat it as a failure instead of showing an empty box.
        if (!feedback.trim()) {
          req.log.error("Gemini check returned an empty response");
          await logCheck("failed", { errorMessage: "Empty AI response" });
          res.status(502).json({
            error: "AI nie zwróciło odpowiedzi. Spróbuj ponownie za chwilę.",
          });
          return;
        }
      }

      const [check] = await logCheck("completed", { aiResponse: feedback });

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

// ─── PER-LESSON AI CHAT ──────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `Jesteś przyjaznym korepetytorem fizyki dla ucznia 7. klasy szkoły podstawowej w Polsce.
- Odpowiadaj zawsze po polsku, prostym i zrozumiałym językiem.
- Wyjaśniaj krok po kroku, podawaj przykłady z życia codziennego.
- Trzymaj się tematu bieżącej lekcji, ale możesz odwoływać się do podstaw fizyki.
- Nie podawaj gotowych rozwiązań zadań domowych wprost — naprowadzaj ucznia.
- Bądź cierpliwy, zachęcający i konkretny. Odpowiedź maksymalnie 6 zdań.
- Jeśli pytanie nie dotyczy fizyki ani nauki, grzecznie wróć do tematu lekcji.
- Pisz zwykłym tekstem, bez notacji LaTeX i Markdown (żadnych $...$, \\cdot, \\text, gwiazdek). Wzory zapisuj jak w zeszycie, np. Fc = m · g, wynik: 50 N.`;

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
});

async function chatWithGemini(
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  message: string,
  modelName: string,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey as string);
  const model = genAI.getGenerativeModel(
    {
      model: modelName,
      systemInstruction: systemPrompt,
    },
    { timeout: GEMINI_TIMEOUT_MS },
  );

  const chat = model.startChat({
    history: history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });
  const result = await chat.sendMessage(message);
  return result.response.text();
}

router.post(
  "/ai/lesson-chat",
  requireAuth as any,
  requireTopicAccessOrPreview("topicId") as any,
  aiLimiter,
  async (req: AuthRequest, res) => {
    try {
      const parsed = lessonChatSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Nieprawidłowe dane", details: parsed.error.issues });
        return;
      }
      const { topicId, message, history } = parsed.data;

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

      const contextPrompt = `${CHAT_SYSTEM_PROMPT}\n\nBieżąca lekcja: "${topic.title}".${
        topic.description ? `\nOpis lekcji: ${topic.description}` : ""
      }`;

      try {
        let reply: string;
        const chatModel = resolveAiModel(aiCfg);
        try {
          reply = await chatWithGemini(contextPrompt, history ?? [], message, chatModel);
        } catch (aiErr) {
          // Same self-healing as the task check: a rejected model name is
          // retried once with the rolling fallback alias.
          if (!isModelUnavailable(aiErr) || chatModel === FALLBACK_AI_MODEL) {
            throw aiErr;
          }
          req.log.warn(
            { model: chatModel, err: aiErr },
            "Gemini model unavailable — retrying with fallback model",
          );
          reply = await chatWithGemini(contextPrompt, history ?? [], message, FALLBACK_AI_MODEL);
        }
        res.json({ reply });
      } catch (aiErr) {
        req.log.error({ err: aiErr }, "Gemini lesson chat failed");
        const mapped = mapGeminiError(
          aiErr,
          "Wystąpił błąd podczas rozmowy z AI. Spróbuj ponownie za chwilę.",
        );
        res.status(mapped.status).json({ error: mapped.error });
      }
    } catch (err) {
      req.log.error({ err }, "Lesson chat error");
      res.status(500).json({ error: "Błąd serwera" });
    }
  },
);

export default router;
