import { Router } from "express";
import { db } from "@workspace/db";
import { tasks, aiChecks, learningProgress } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { requireCourseAccess, getCourseIdByTaskId } from "../lib/access";
import { config, isGeminiConfigured } from "../config/env";

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Zbyt wiele zapytań do AI. Spróbuj ponownie za kilka minut." },
  standardHeaders: true,
  legacyHeaders: false,
});

const SYSTEM_PROMPT = `Jesteś pomocnym nauczycielem fizyki. Oceniasz rozwiązanie ucznia klasy 7. 
Odpowiedz po polsku, krótko i przyjaźnie. 
- Wskaż co jest dobrze zrobione
- Wskaż co można poprawić (jeśli coś wymaga poprawy)
- Nie wyśmiewaj ucznia
- Używaj prostego języka dla ucznia 7. klasy
- Bądź konkretny i pomocny
- Odpowiedź powinna być max 3-4 zdania`;

async function checkWithGemini(
  imageBase64: string,
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
        data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, ""),
        mimeType: "image/png",
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
      if (!taskId || !imageBase64) {
        res.status(400).json({ error: "taskId i imageBase64 są wymagane" });
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
          feedback = await checkWithGemini(imageBase64, task.description ?? task.title);
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
