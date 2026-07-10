// ============================================================================
// IMPORT treści e-learningu do bazy (uruchamiany na VPS po `git pull`).
//
// Czyta pliki z katalogu `scripts/data/export/` (wygenerowane przez
// export-elearning.ts na Replit i zacommitowane do GitHuba) i odtwarza treść na VPS.
//
// IDEMPOTENTNY: dopasowuje wiersze po KLUCZACH NATURALNYCH (slug/tytuł/etykieta),
// nie po id z Replit — bo id na VPS są inne. Ponowne uruchomienie nie tworzy
// duplikatów.
//
// TRYBY:
//   (domyślnie / --mode=merge)   Dodaje brakujące i AKTUALIZUJE istniejące
//                                wiersze, aby baza odpowiadała eksportowi.
//                                NIGDY nie usuwa danych. Bezpieczny na produkcji.
//   --mode=replace-demo-content  Usuwa treść eksportowanych kursów i ustawień,
//                                po czym importuje od nowa (dokładne lustro).
//                                WYMAGA --yes ORAZ pustej bazy bez danych
//                                klientów (płatności/dostępy/postępy/quizy) —
//                                w przeciwnym razie PRZERYWA, by nie skasować
//                                danych użytkowników.
//   --dry-run                    Pokazuje, co zostałoby zmienione, i wycofuje
//                                transakcję (żadnych zapisów).
//
// Użycie:
//   pnpm --filter @workspace/scripts run import:elearning
//   pnpm --filter @workspace/scripts run import:elearning -- --dry-run
//   pnpm --filter @workspace/scripts run import:elearning -- --mode=merge
//   pnpm --filter @workspace/scripts run import:elearning -- --mode=replace-demo-content --yes
// ============================================================================
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, inArray } from "drizzle-orm";
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import * as schema from "../../lib/db/src/schema/index.js";
import {
  videoNaturalKey,
  imageNaturalKey,
  quizNaturalKey,
  taskNaturalKey,
  questionNaturalKey,
  answerNaturalKey,
} from "./content-io/tables.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nie jest ustawione");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const {
  courses,
  sections,
  topics,
  videos,
  lessonImages,
  quizzes,
  quizQuestions,
  quizAnswers,
  tasks,
  landingSections,
  faqItems,
  seoSettings,
  aiSettings,
  pricingSettings,
  platformSettings,
  payments,
  accessGrants,
  learningProgress,
  videoProgress,
  quizAttempts,
  contentMigrations,
} = schema;

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/src → scripts/data/export. Nadpisywalne przez ENV (używane w testach).
const EXPORT_DIR = process.env.EXPORT_DIR
  ? resolve(process.env.EXPORT_DIR)
  : join(__dirname, "../data/export");

type Mode = "merge" | "replace-demo-content";

function parseArgs(): { mode: Mode; dryRun: boolean; yes: boolean } {
  const args = process.argv.slice(2);
  let mode: Mode = "merge";
  let dryRun = false;
  let yes = false;
  for (const a of args) {
    if (a === "--dry-run") dryRun = true;
    else if (a === "--yes") yes = true;
    else if (a.startsWith("--mode=")) {
      const v = a.slice("--mode=".length);
      if (v === "merge" || v === "replace-demo-content") mode = v;
      else throw new Error(`Nieznany tryb: ${v} (dozwolone: merge, replace-demo-content)`);
    } else throw new Error(`Nieznany argument: ${a}`);
  }
  return { mode, dryRun, yes };
}

function loadExport(): Record<string, any> {
  const combinedPath = join(EXPORT_DIR, "full-elearning-export.json");
  if (!existsSync(combinedPath)) {
    throw new Error(
      `Brak pliku eksportu: ${combinedPath}\n` +
        "Najpierw uruchom eksport na Replit (pnpm --filter @workspace/scripts run export:elearning) " +
        "i zacommituj katalog scripts/data/export/ do GitHuba.",
    );
  }
  return JSON.parse(readFileSync(combinedPath, "utf8"));
}

const toDate = (v: unknown): Date | null => (v == null ? null : new Date(v as string));

// Rzucane celowo, aby wycofać transakcję w trybie --dry-run.
class DryRunRollback extends Error {}

type Stat = { created: number; updated: number };
const stat = (): Stat => ({ created: 0, updated: 0 });

async function main() {
  const { mode, dryRun, yes } = parseArgs();
  const data = loadExport();

  console.log(
    `==> Import treści (tryb: ${mode}${dryRun ? " + DRY-RUN" : ""}). Źródło: scripts/data/export/full-elearning-export.json`,
  );
  if (data.meta?.exportedAt) console.log(`    Eksport z: ${data.meta.exportedAt}`);

  // ── Zabezpieczenie trybu replace-demo-content ────────────────────────────
  if (mode === "replace-demo-content") {
    if (!yes && !dryRun) {
      throw new Error(
        "Tryb replace-demo-content jest destrukcyjny. Dodaj flagę --yes, aby potwierdzić.",
      );
    }
    const blockers: string[] = [];
    const guard = async (table: any, label: string, where?: any) => {
      const q = db.select({ id: table.id }).from(table).limit(1);
      const [row] = await (where ? q.where(where) : q);
      if (row) blockers.push(label);
    };
    await guard(payments, "płatności");
    await guard(accessGrants, "dostępy z płatności", eq(accessGrants.source, "payment"));
    await guard(learningProgress, "postępy nauki");
    await guard(videoProgress, "postępy wideo");
    await guard(quizAttempts, "podejścia do quizów");
    if (blockers.length > 0) {
      throw new Error(
        `Tryb replace-demo-content PRZERWANY: baza zawiera dane klientów (${blockers.join(", ")}). ` +
          "Reset mógłby je skasować (kaskady FK). Użyj trybu --mode=merge, który tylko dodaje i " +
          "aktualizuje treść bez usuwania danych.",
      );
    }
  }

  const stats: Record<string, Stat> = {
    courses: stat(),
    sections: stat(),
    topics: stat(),
    videos: stat(),
    lesson_images: stat(),
    quizzes: stat(),
    quiz_questions: stat(),
    quiz_answers: stat(),
    tasks: stat(),
    settings: stat(),
  };

  // Uniwersalny upsert po kluczu naturalnym. `values` NIE zawiera id (poza
  // singletonami, które przekazują id:1). Zwraca id z bazy VPS.
  async function upsert(
    tx: any,
    table: any,
    findWhere: any,
    values: Record<string, unknown>,
    s: Stat,
  ): Promise<number> {
    const [existing] = await tx.select().from(table).where(findWhere).limit(1);
    if (existing) {
      await tx
        .update(table)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(table.id, existing.id));
      s.updated += 1;
      return existing.id as number;
    }
    const [ins] = await tx.insert(table).values(values).returning();
    s.created += 1;
    return ins.id as number;
  }

  try {
    await db.transaction(async (tx: any) => {
      // W trybie replace usuwamy treść eksportowanych kursów (kaskada FK
      // czyści działy/lekcje/materiały/quizy/zadania) oraz zarządzane
      // ustawienia. Zabezpieczenie wyżej gwarantuje brak danych klientów.
      if (mode === "replace-demo-content") {
        const slugs = (data.courses ?? []).map((c: any) => c.slug);
        if (slugs.length) await tx.delete(courses).where(inArray(courses.slug, slugs));
        await tx.delete(landingSections);
        await tx.delete(faqItems);
        await tx.delete(platformSettings);
        console.log("    replace-demo-content: usunięto poprzednią treść (kaskadowo).");
      }

      // Mapy: id z eksportu (Replit) → id w bazie VPS. Pozwalają rozwiązać FK
      // dzieci bez polegania na id z Replit.
      const courseMap = new Map<number, number>();
      const sectionMap = new Map<number, number>();
      const topicMap = new Map<number, number>();
      const quizMap = new Map<number, number>();
      const questionMap = new Map<number, number>();

      // 1) Kursy — klucz: slug
      for (const c of data.courses ?? []) {
        const id = await upsert(
          tx,
          courses,
          eq(courses.slug, c.slug),
          {
            title: c.title,
            slug: c.slug,
            description: c.description ?? "",
            status: c.status ?? "published",
            isPublished: c.isPublished ?? (c.status === "published"),
          },
          stats.courses,
        );
        courseMap.set(c.id, id);
      }

      // 2) Działy — klucz: (courseId, slug)
      for (const s of data.sections ?? []) {
        const courseId = courseMap.get(s.courseId);
        if (!courseId) continue;
        const id = await upsert(
          tx,
          sections,
          and(eq(sections.courseId, courseId), eq(sections.slug, s.slug)),
          {
            courseId,
            title: s.title,
            slug: s.slug,
            sortOrder: s.sortOrder ?? 0,
            bunnyCollectionId: s.bunnyCollectionId ?? null,
            status: s.status ?? "published",
          },
          stats.sections,
        );
        sectionMap.set(s.id, id);
      }

      // 3) Lekcje — klucz: (sectionId, slug)
      for (const t of data.topics ?? []) {
        const sectionId = sectionMap.get(t.sectionId);
        if (!sectionId) continue;
        const id = await upsert(
          tx,
          topics,
          and(eq(topics.sectionId, sectionId), eq(topics.slug, t.slug)),
          {
            sectionId,
            title: t.title,
            slug: t.slug,
            description: t.description ?? null,
            objectives: t.objectives ?? null,
            durationMinutes: t.durationMinutes ?? null,
            difficulty: t.difficulty ?? null,
            accessType: t.accessType ?? "paid",
            thumbnailUrl: t.thumbnailUrl ?? null,
            metaTitle: t.metaTitle ?? null,
            metaDescription: t.metaDescription ?? null,
            aiEnabled: t.aiEnabled ?? true,
            sortOrder: t.sortOrder ?? 0,
            isPreview: t.isPreview ?? false,
            status: t.status ?? "published",
          },
          stats.topics,
        );
        topicMap.set(t.id, id);
      }

      // 4) Wideo — dopasowanie: NAJPIERW globalnie po bunnyVideoId (kolumna
      //    UNIKALNA — ten sam token Bunny nie może istnieć dwa razy), a gdy go
      //    brak, awaryjnie po (topicId, kluczu naturalnym). Dzięki temu wideo
      //    przeniesione w panelu do innej lekcji zostaje ZAKTUALIZOWANE (nowy
      //    topicId), a nie wstawione ponownie — inaczej nowy wiersz naruszyłby
      //    unikalność bunny_video_id w środku transakcji.
      for (const v of data.videos ?? []) {
        const topicId = topicMap.get(v.topicId);
        if (!topicId) continue;
        const values = {
          topicId,
          bunnyVideoId: v.bunnyVideoId ?? null,
          bunnyTitle: v.bunnyTitle ?? null,
          videoUrl: v.videoUrl ?? null,
          title: v.title,
          durationSeconds: v.durationSeconds ?? null,
          sortOrder: v.sortOrder ?? 0,
        };
        let existing: any;
        if (v.bunnyVideoId) {
          [existing] = await tx
            .select()
            .from(videos)
            .where(eq(videos.bunnyVideoId, v.bunnyVideoId))
            .limit(1);
        }
        if (!existing) {
          const key = videoNaturalKey(v);
          const rows = await tx.select().from(videos).where(eq(videos.topicId, topicId));
          existing = rows.find((r: any) => videoNaturalKey(r) === key);
        }
        if (existing) {
          await tx.update(videos).set({ ...values, updatedAt: new Date() }).where(eq(videos.id, existing.id));
          stats.videos.updated += 1;
        } else {
          await tx.insert(videos).values(values);
          stats.videos.created += 1;
        }
      }

      // 5) Grafiki lekcji — klucz: (topicId, imageUrl)
      for (const img of data.lesson_images ?? []) {
        const topicId = topicMap.get(img.topicId);
        if (!topicId) continue;
        const key = imageNaturalKey(img);
        const rows = await tx.select().from(lessonImages).where(eq(lessonImages.topicId, topicId));
        const existing = rows.find((r: any) => imageNaturalKey(r) === key);
        const values = {
          topicId,
          imageUrl: img.imageUrl,
          alt: img.alt ?? null,
          answer: img.answer ?? null,
          solution: img.solution ?? null,
          relatedVideoTitle: img.relatedVideoTitle ?? null,
          sortOrder: img.sortOrder ?? 0,
        };
        if (existing) {
          await tx.update(lessonImages).set({ ...values, updatedAt: new Date() }).where(eq(lessonImages.id, existing.id));
          stats.lesson_images.updated += 1;
        } else {
          await tx.insert(lessonImages).values(values);
          stats.lesson_images.created += 1;
        }
      }

      // 6) Quizy — klucz: (topicId, title)
      for (const qz of data.quizzes ?? []) {
        const topicId = topicMap.get(qz.topicId);
        if (!topicId) continue;
        const key = quizNaturalKey(qz);
        const rows = await tx.select().from(quizzes).where(eq(quizzes.topicId, topicId));
        const existing = rows.find((r: any) => quizNaturalKey(r) === key);
        const values = {
          topicId,
          title: qz.title,
          passThreshold: qz.passThreshold ?? 80,
          maxAttempts: qz.maxAttempts ?? null,
          timeLimitMinutes: qz.timeLimitMinutes ?? null,
          shuffleQuestions: qz.shuffleQuestions ?? false,
          shuffleAnswers: qz.shuffleAnswers ?? false,
          showScore: qz.showScore ?? true,
          showCorrectAnswers: qz.showCorrectAnswers ?? true,
          status: qz.status ?? "published",
        };
        let id: number;
        if (existing) {
          await tx.update(quizzes).set({ ...values, updatedAt: new Date() }).where(eq(quizzes.id, existing.id));
          stats.quizzes.updated += 1;
          id = existing.id;
        } else {
          const [ins] = await tx.insert(quizzes).values(values).returning();
          stats.quizzes.created += 1;
          id = ins.id;
        }
        quizMap.set(qz.id, id);
      }

      // 7) Pytania quizu — klucz: (quizId, sortOrder)
      for (const q of data.quiz_questions ?? []) {
        const quizId = quizMap.get(q.quizId);
        if (!quizId) continue;
        const key = questionNaturalKey(q);
        const rows = await tx.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId));
        const existing = rows.find((r: any) => questionNaturalKey(r) === key);
        const values = {
          quizId,
          questionText: q.questionText,
          explanation: q.explanation ?? null,
          points: q.points ?? 1,
          sortOrder: q.sortOrder ?? 0,
        };
        let id: number;
        if (existing) {
          await tx.update(quizQuestions).set({ ...values, updatedAt: new Date() }).where(eq(quizQuestions.id, existing.id));
          stats.quiz_questions.updated += 1;
          id = existing.id;
        } else {
          const [ins] = await tx.insert(quizQuestions).values(values).returning();
          stats.quiz_questions.created += 1;
          id = ins.id;
        }
        questionMap.set(q.id, id);
      }

      // 8) Odpowiedzi quizu — klucz: (questionId, answerLabel)
      for (const a of data.quiz_answers ?? []) {
        const questionId = questionMap.get(a.questionId);
        if (!questionId) continue;
        const key = answerNaturalKey(a);
        const rows = await tx.select().from(quizAnswers).where(eq(quizAnswers.questionId, questionId));
        const existing = rows.find((r: any) => answerNaturalKey(r) === key);
        const values = {
          questionId,
          answerLabel: a.answerLabel,
          answerText: a.answerText,
          isCorrect: a.isCorrect ?? false,
          sortOrder: a.sortOrder ?? 0,
        };
        if (existing) {
          await tx.update(quizAnswers).set({ ...values, updatedAt: new Date() }).where(eq(quizAnswers.id, existing.id));
          stats.quiz_answers.updated += 1;
        } else {
          await tx.insert(quizAnswers).values(values);
          stats.quiz_answers.created += 1;
        }
      }

      // 9) Zadania interaktywne — klucz: (topicId, title)
      for (const tk of data.tasks ?? []) {
        const topicId = topicMap.get(tk.topicId);
        if (!topicId) continue;
        const key = taskNaturalKey(tk);
        const rows = await tx.select().from(tasks).where(eq(tasks.topicId, topicId));
        const existing = rows.find((r: any) => taskNaturalKey(r) === key);
        const values = {
          topicId,
          title: tk.title,
          description: tk.description ?? null,
          initialImageUrl: tk.initialImageUrl ?? null,
          aiPromptConfig: tk.aiPromptConfig ?? null,
        };
        if (existing) {
          await tx.update(tasks).set({ ...values, updatedAt: new Date() }).where(eq(tasks.id, existing.id));
          stats.tasks.updated += 1;
        } else {
          await tx.insert(tasks).values(values);
          stats.tasks.created += 1;
        }
      }

      // 10) Ustawienia / CMS ────────────────────────────────────────────────
      // Sekcje landing — klucz: key
      for (const ls of data.landing_sections ?? []) {
        await upsert(
          tx,
          landingSections,
          eq(landingSections.key, ls.key),
          {
            key: ls.key,
            title: ls.title ?? "",
            sortOrder: ls.sortOrder ?? 0,
            isEnabled: ls.isEnabled ?? true,
            content: ls.content ?? null,
          },
          stats.settings,
        );
      }
      // FAQ — klucz: question (brak innego stabilnego identyfikatora)
      for (const f of data.faq_items ?? []) {
        await upsert(
          tx,
          faqItems,
          eq(faqItems.question, f.question),
          {
            question: f.question,
            answer: f.answer,
            sortOrder: f.sortOrder ?? 0,
            isVisible: f.isVisible ?? true,
          },
          stats.settings,
        );
      }
      // platform_settings — klucz: key
      for (const p of data.platform_settings ?? []) {
        await upsert(
          tx,
          platformSettings,
          eq(platformSettings.key, p.key),
          { key: p.key, value: p.value ?? "" },
          stats.settings,
        );
      }
      // Singletony (id=1): seo, ai, pricing
      for (const so of data.seo_settings ?? []) {
        await upsert(
          tx,
          seoSettings,
          eq(seoSettings.id, 1),
          {
            id: 1,
            metaTitle: so.metaTitle ?? "",
            metaDescription: so.metaDescription ?? "",
            ogTitle: so.ogTitle ?? "",
            ogDescription: so.ogDescription ?? "",
            ogImage: so.ogImage ?? "",
            canonicalUrl: so.canonicalUrl ?? "",
            robots: so.robots ?? "index, follow",
          },
          stats.settings,
        );
      }
      for (const ai of data.ai_settings ?? []) {
        await upsert(
          tx,
          aiSettings,
          eq(aiSettings.id, 1),
          {
            id: 1,
            enabled: ai.enabled ?? true,
            model: ai.model ?? "gemini-1.5-flash",
            systemPrompt: ai.systemPrompt ?? "",
            evalInstruction: ai.evalInstruction ?? "",
            tone: ai.tone ?? "",
            maxResponseLength: ai.maxResponseLength ?? 0,
            errorMessage: ai.errorMessage ?? "",
          },
          stats.settings,
        );
      }
      for (const pr of data.pricing_settings ?? []) {
        await upsert(
          tx,
          pricingSettings,
          eq(pricingSettings.id, 1),
          {
            id: 1,
            priceGrosz: pr.priceGrosz ?? 3500,
            oldPriceGrosz: pr.oldPriceGrosz ?? 19900,
            currency: pr.currency ?? "PLN",
            promoEnabled: pr.promoEnabled ?? true,
            promoLabel: pr.promoLabel ?? "",
            promoStartsAt: toDate(pr.promoStartsAt),
            promoEndsAt: toDate(pr.promoEndsAt),
            ctaText: pr.ctaText ?? "",
          },
          stats.settings,
        );
      }

      if (dryRun) throw new DryRunRollback();
    });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }

  // ── Raport ────────────────────────────────────────────────────────────────
  console.log(`\n${dryRun ? "PODGLĄD (bez zapisu) — " : ""}Podsumowanie importu:`);
  let created = 0;
  let updated = 0;
  for (const [name, s] of Object.entries(stats)) {
    if (s.created || s.updated) {
      console.log(`   • ${name}: +${s.created} nowych, ~${s.updated} zaktualizowanych`);
    }
    created += s.created;
    updated += s.updated;
  }
  console.log(
    `\n==> ${dryRun ? "DRY-RUN: " : ""}${dryRun ? "zostałoby " : ""}dodane ${created}, zaktualizowane ${updated} wierszy.`,
  );
  if (dryRun) console.log("   Nic nie zapisano. Uruchom bez --dry-run, aby wykonać import.");
  else console.log("   Zalecane: uruchom `verify:content`, aby potwierdzić wynik.");

  // ── Ślad audytu (§12) ──────────────────────────────────────────────────────
  // Zapisz, który eksport (po sumie kontrolnej treści) został ostatnio
  // zaimportowany. To NIE jest migracja wersjonowana — te obsługuje osobno
  // `content:migrate`. Tu trzymamy jeden wiersz-znacznik (name="import:elearning")
  // aktualizowany przy każdym imporcie. Zapis POZA transakcją treści; ewentualny
  // błąd audytu tylko ostrzega i nie wycofuje udanego importu.
  if (!dryRun) {
    try {
      const { meta, ...content } = data;
      const checksum = createHash("sha256").update(JSON.stringify(content)).digest("hex");
      const details = { mode, exportedAt: meta?.exportedAt ?? null, created, updated, stats };
      const [existing] = await db
        .select()
        .from(contentMigrations)
        .where(eq(contentMigrations.name, "import:elearning"))
        .limit(1);
      if (existing) {
        await db
          .update(contentMigrations)
          .set({
            checksum,
            status: "applied",
            appliedBy: "import:elearning",
            detailsJson: details,
            appliedAt: new Date(),
          })
          .where(eq(contentMigrations.id, existing.id));
      } else {
        await db.insert(contentMigrations).values({
          name: "import:elearning",
          checksum,
          status: "applied",
          appliedBy: "import:elearning",
          detailsJson: details,
        });
      }
    } catch (e) {
      console.warn(
        "   (uwaga) Nie zapisano śladu audytu w content_migrations:",
        (e as Error).message,
      );
    }
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("BŁĄD importu:", err.message ?? err);
  await pool.end();
  process.exit(1);
});
