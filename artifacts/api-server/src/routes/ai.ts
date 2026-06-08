import { Router } from "express";
import { db } from "@workspace/db";
import { tasks, aiChecks, learningProgress } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { aiLimiter } from "../middlewares/rate-limit";
import { requireCourseAccess, getCourseIdByTaskId } from "../lib/access";
import { config, isGeminiConfigured } from "../config/env";

const router = Router();

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB decoded
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

type ImageValidation =
  | { ok: true; mimeType: string; data: string }
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
      error: "Nieobsługiwany format obrazu. Dozwolone: PNG, JPEG, WEBP.",
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
    return { ok: false, status: 413, error: "Obraz jest zbyt duży (maks. 4 MB)" };
  }
  return { ok: true, mimeType, data: raw };
}

const SYSTEM_PROMPT = `Jesteś pomocnym nauczycielem fizyki. Oceniasz rozwiązanie ucznia klasy 7. 
Odpowiedz po polsku, krótko i przyjaźnie. 
- Wskaż co jest dobrze zrobione
- Wskaż co można poprawić (jeśli coś wymaga poprawy)
- Nie wyśmiewaj ucznia
- Używaj prostego języka dla ucznia 7. klasy
- Bądź konkretny i pomocny
- Odpowiedź powinna być max 3-4 zdania`;

async function checkWithGemini(
  imageData: string,
  mimeType: string,
  taskDescription: string,
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey as string);
  const model = genAI.getGenerativeModel({ model: config.gemini.model });

  const result = await model.generateContent([
    SYSTEM_PROMPT,
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
  "/ai/check-task",
  requireAuth as any,
  requireCourseAccess((req) => getCourseIdByTaskId(Number(req.body?.taskId))) as any,
  aiLimiter,
  async (req: AuthRequest, res) => {
    try {
      const { taskId, imageBase64 } = req.body;
      if (!taskId) {
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

      let feedback: string;
      if (!isGeminiConfigured()) {
        if (config.isProd) {
          res.status(503).json({
            error: "Sprawdzanie AI jest chwilowo niedostępne. Spróbuj ponownie później.",
          });
          return;
        }
        feedback =
          "Sprawdzanie AI działa w trybie demonstracyjnym. Skonfiguruj GEMINI_API_KEY, aby włączyć prawdziwe sprawdzanie. Twoje rozwiązanie wygląda na staranne!";
      } else {
        try {
          feedback = await checkWithGemini(image.data, image.mimeType, task.description ?? task.title);
        } catch (aiErr) {
          req.log.error({ err: aiErr }, "Gemini check failed");
          res.status(502).json({
            error: "Wystąpił błąd podczas sprawdzania przez AI. Spróbuj ponownie.",
          });
          return;
        }
      }

      const [check] = await db
        .insert(aiChecks)
        .values({
          userId: req.user!.id,
          taskId,
          topicId: task.topicId,
          aiResponse: feedback,
          status: "completed",
        })
        .returning();

      await db
        .update(learningProgress)
        .set({ taskCheckedByAi: true, updatedAt: new Date() })
        .where(
          and(
            eq(learningProgress.userId, req.user!.id),
            eq(learningProgress.topicId, task.topicId),
          ),
        );

      res.json({ feedback, checkId: check.id });
    } catch (err) {
      req.log.error({ err }, "AI check error");
      res.status(500).json({ error: "Błąd serwera" });
    }
  },
);

export default router;
