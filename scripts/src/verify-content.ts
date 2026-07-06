// ============================================================================
// WALIDACJA treści po wdrożeniu (uruchamiana na VPS wewnątrz kontenera API).
//
// Sprawdza, czy po imporcie treść e-learningu jest KOMPLETNA i SPÓJNA oraz czy
// ustawione są kluczowe zmienne środowiskowe (w tym Bunny.net). Kończy się kodem
// != 0, jeśli którykolwiek TWARDY warunek (❌) nie jest spełniony — dzięki temu
// nadaje się jako bramka w skryptach deploy/CI.
//
// Kontrole:
//   • połączenie z bazą,
//   • liczności rdzenia (kursy/działy/lekcje/zadania = 0 → TWARDY błąd; wideo = 0 → ostrzeżenie),
//   • wiersze-sieroty (dzieci bez rodzica — mimo FK, jako siatka bezpieczeństwa),
//   • duplikaty kluczy naturalnych (działy, lekcje, zadania, bunny_video_id),
//   • braki wymaganych pól (title/slug/sort_order),
//   • powiązania Bunny.net (każde wideo ma bunny_video_id LUB video_url),
//   • zmienne środowiskowe (twarde + zalecane).
//
// Użycie:   pnpm --filter @workspace/scripts run verify:content
// ============================================================================
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "../../lib/db/src/schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL nie jest ustawione — nie mogę połączyć się z bazą.");
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

let hardFail = false;
const ok = (m: string) => console.log(`✅ ${m}`);
const warn = (m: string) => console.log(`⚠️  ${m}`);
const err = (m: string) => {
  console.log(`❌ ${m}`);
  hardFail = true;
};

// Skalar z surowego SQL (elastyczniejszy niż query-builder przy JOIN/GROUP BY).
async function scalar(query: any): Promise<number> {
  const res: any = await db.execute(query);
  const rows = res.rows ?? res;
  return Number(rows?.[0]?.n ?? 0);
}

async function main() {
  console.log("==> Weryfikacja treści po wdrożeniu\n");

  // 1) Połączenie z bazą
  try {
    await db.execute(sql`select 1`);
    ok("Połączenie z bazą danych działa.");
  } catch (e) {
    err(`Brak połączenia z bazą: ${(e as Error).message}`);
    console.log("\n==> WYNIK: NIEPOWODZENIE (baza nieosiągalna).");
    await pool.end();
    process.exit(1);
  }

  // 2) Liczności rdzenia treści ────────────────────────────────────────────
  const nCourses = await scalar(sql`select count(*)::int as n from courses`);
  const nSections = await scalar(sql`select count(*)::int as n from sections`);
  const nTopics = await scalar(sql`select count(*)::int as n from topics`);
  const nTasks = await scalar(sql`select count(*)::int as n from tasks`);
  const nVideos = await scalar(sql`select count(*)::int as n from videos`);

  nCourses > 0 ? ok(`Kursy: ${nCourses}`) : err("Brak kursów w bazie (0).");
  nSections > 0 ? ok(`Działy: ${nSections}`) : err("Brak działów w bazie (0).");
  nTopics > 0 ? ok(`Lekcje: ${nTopics}`) : err("Brak lekcji w bazie (0).");
  nTasks > 0 ? ok(`Zadania: ${nTasks}`) : err("Brak zadań w bazie (0).");
  nVideos > 0 ? ok(`Wideo: ${nVideos}`) : warn("Brak wideo w bazie (0).");

  // 3) Wiersze-sieroty (dziecko bez rodzica). Klucze obce powinny to wykluczać,
  //    ale tania kontrola chroni przed ręcznymi zmianami w bazie.
  console.log("");
  const orphans: [string, any][] = [
    ["działy bez kursu", sql`select count(*)::int as n from sections s left join courses c on c.id = s.course_id where c.id is null`],
    ["lekcje bez działu", sql`select count(*)::int as n from topics t left join sections s on s.id = t.section_id where s.id is null`],
    ["wideo bez lekcji", sql`select count(*)::int as n from videos v left join topics t on t.id = v.topic_id where t.id is null`],
    ["zadania bez lekcji", sql`select count(*)::int as n from tasks tk left join topics t on t.id = tk.topic_id where t.id is null`],
    ["grafiki bez lekcji", sql`select count(*)::int as n from lesson_images li left join topics t on t.id = li.topic_id where t.id is null`],
    ["quizy bez lekcji", sql`select count(*)::int as n from quizzes q left join topics t on t.id = q.topic_id where t.id is null`],
    ["pytania bez quizu", sql`select count(*)::int as n from quiz_questions qq left join quizzes q on q.id = qq.quiz_id where q.id is null`],
    ["odpowiedzi bez pytania", sql`select count(*)::int as n from quiz_answers qa left join quiz_questions qq on qq.id = qa.question_id where qq.id is null`],
  ];
  let orphanTotal = 0;
  for (const [label, q] of orphans) {
    const n = await scalar(q);
    orphanTotal += n;
    if (n > 0) err(`Sieroty (${label}): ${n}.`);
  }
  if (orphanTotal === 0) ok("Brak wierszy-sierot (spójność relacji zachowana).");

  // 4) Duplikaty kluczy naturalnych. Unikalne indeksy powinny je blokować, ale
  //    walidacja potwierdza to na żywej bazie.
  console.log("");
  const dups: [string, any][] = [
    ["działy (course_id, slug)", sql`select count(*)::int as n from (select course_id, slug from sections group by course_id, slug having count(*) > 1) x`],
    ["lekcje (section_id, slug)", sql`select count(*)::int as n from (select section_id, slug from topics group by section_id, slug having count(*) > 1) x`],
    ["zadania (topic_id, title)", sql`select count(*)::int as n from (select topic_id, title from tasks group by topic_id, title having count(*) > 1) x`],
    ["wideo (bunny_video_id)", sql`select count(*)::int as n from (select bunny_video_id from videos where bunny_video_id is not null group by bunny_video_id having count(*) > 1) x`],
  ];
  let dupTotal = 0;
  for (const [label, q] of dups) {
    const n = await scalar(q);
    dupTotal += n;
    if (n > 0) err(`Duplikaty ${label}: ${n} grup.`);
  }
  if (dupTotal === 0) ok("Brak duplikatów kluczy naturalnych.");

  // 5) Braki wymaganych pól ─────────────────────────────────────────────────
  console.log("");
  const missing: [string, any][] = [
    ["kursy bez title/slug", sql`select count(*)::int as n from courses where title is null or btrim(title) = '' or slug is null or btrim(slug) = ''`],
    ["działy bez title/slug/sort_order", sql`select count(*)::int as n from sections where title is null or btrim(title) = '' or slug is null or btrim(slug) = '' or sort_order is null`],
    ["lekcje bez title/slug/sort_order", sql`select count(*)::int as n from topics where title is null or btrim(title) = '' or slug is null or btrim(slug) = '' or sort_order is null`],
    ["zadania bez title", sql`select count(*)::int as n from tasks where title is null or btrim(title) = ''`],
    ["wideo bez sort_order", sql`select count(*)::int as n from videos where sort_order is null`],
  ];
  let missingTotal = 0;
  for (const [label, q] of missing) {
    const n = await scalar(q);
    missingTotal += n;
    if (n > 0) err(`Braki pól (${label}): ${n}.`);
  }
  if (missingTotal === 0) ok("Wszystkie wymagane pola (title/slug/sort_order) obecne.");

  // 6) Powiązania Bunny.net — każde wideo powinno mieć bunny_video_id LUB video_url.
  console.log("");
  if (nVideos > 0) {
    const withRef = await scalar(
      sql`select count(*)::int as n from videos where bunny_video_id is not null or video_url is not null`,
    );
    const missingRef = nVideos - withRef;
    if (missingRef === 0) ok(`Wszystkie wideo (${nVideos}) mają powiązanie z Bunny.net.`);
    else if (withRef === 0) err(`Żadne wideo nie ma powiązania z Bunny.net (${nVideos} bez ID/URL).`);
    else warn(`${missingRef}/${nVideos} wideo bez powiązania z Bunny.net (brak bunny_video_id i video_url).`);
  }

  // 7) Zmienne środowiskowe ──────────────────────────────────────────────────
  console.log("");
  // Twarde: bez nich odtwarzanie wideo / połączenie z bazą jest niemożliwe.
  const requiredEnv = ["DATABASE_URL", "BUNNY_LIBRARY_ID"];
  for (const name of requiredEnv) {
    process.env[name] ? ok(`ENV ${name} ustawione.`) : err(`Brak wymaganej zmiennej ${name}.`);
  }
  // Zalecane: potrzebne w produkcji, ale brak nie blokuje samej weryfikacji treści.
  const recommendedEnv = [
    "BUNNY_CDN_HOSTNAME",
    "CLERK_SECRET_KEY",
    "CLERK_PUBLISHABLE_KEY",
    "APP_URL",
    "SESSION_SECRET",
    "GEMINI_API_KEY",
  ];
  for (const name of recommendedEnv) {
    process.env[name] ? ok(`ENV ${name} ustawione.`) : warn(`Zalecana zmienna ${name} nie jest ustawiona.`);
  }

  console.log("");
  if (hardFail) {
    console.log("==> WYNIK: NIEPOWODZENIE — popraw powyższe błędy (❌) przed produkcją.");
    await pool.end();
    process.exit(1);
  }
  console.log("==> WYNIK: OK — treść jest kompletna i spójna.");
  await pool.end();
}

main().catch(async (e) => {
  console.error("BŁĄD weryfikacji:", e);
  await pool.end();
  process.exit(1);
});
