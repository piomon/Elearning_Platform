// ============================================================================
// WALIDACJA wdrożenia (uruchamiana na VPS wewnątrz kontenera API).
//
// Sprawdza, czy po imporcie treść e-learningu i integracja Bunny.net są na
// miejscu oraz czy ustawione są kluczowe zmienne środowiskowe. Kończy się
// kodem != 0, jeśli którykolwiek TWARDY warunek nie jest spełniony (przydatne
// w skryptach CI/deploy).
//
// Użycie:   pnpm --filter @workspace/scripts run verify:deployment
// ============================================================================
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, isNotNull, or } from "drizzle-orm";
import pg from "pg";
import * as schema from "../../lib/db/src/schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL nie jest ustawione — nie mogę połączyć się z bazą.");
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { courses, sections, topics, videos } = schema;

let hardFail = false;
const ok = (m: string) => console.log(`✅ ${m}`);
const warn = (m: string) => console.log(`⚠️  ${m}`);
const err = (m: string) => {
  console.log(`❌ ${m}`);
  hardFail = true;
};

async function count(table: any, where?: any): Promise<number> {
  const q = db.select({ n: sql<number>`count(*)::int` }).from(table);
  const [row] = await (where ? q.where(where) : q);
  return row?.n ?? 0;
}

async function main() {
  console.log("==> Weryfikacja wdrożenia\n");

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

  // 2) Treść e-learningu
  const nCourses = await count(courses);
  const nSections = await count(sections);
  const nTopics = await count(topics);
  const nVideos = await count(videos);

  nCourses > 0 ? ok(`Kursy: ${nCourses}`) : err("Brak kursów w bazie (0).");
  nSections > 0 ? ok(`Działy: ${nSections}`) : err("Brak działów w bazie (0).");
  nTopics > 0 ? ok(`Lekcje: ${nTopics}`) : err("Brak lekcji w bazie (0).");
  nVideos > 0 ? ok(`Wideo: ${nVideos}`) : warn("Brak wideo w bazie (0).");

  // 3) Powiązania Bunny.net — każde wideo powinno mieć bunnyVideoId LUB videoUrl
  if (nVideos > 0) {
    const withRef = await count(videos, or(isNotNull(videos.bunnyVideoId), isNotNull(videos.videoUrl)));
    const missing = nVideos - withRef;
    if (missing === 0) ok(`Wszystkie wideo (${nVideos}) mają powiązanie z Bunny.net.`);
    else if (withRef === 0) err(`Żadne wideo nie ma powiązania z Bunny.net (${nVideos} bez ID/URL).`);
    else warn(`${missing}/${nVideos} wideo bez powiązania z Bunny.net (brak bunnyVideoId i videoUrl).`);
  }

  // 4) Zmienne środowiskowe
  console.log("");
  // Twarde: bez nich odtwarzanie wideo / działanie serwera jest niemożliwe.
  const requiredEnv = ["DATABASE_URL", "BUNNY_LIBRARY_ID"];
  for (const name of requiredEnv) {
    process.env[name] ? ok(`ENV ${name} ustawione.`) : err(`Brak wymaganej zmiennej ${name}.`);
  }
  // Miękkie: zalecane w produkcji, ale brak nie blokuje samego odtworzenia treści.
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
  console.log("==> WYNIK: OK — wdrożenie wygląda poprawnie.");
  await pool.end();
}

main().catch(async (e) => {
  console.error("BŁĄD weryfikacji:", e);
  await pool.end();
  process.exit(1);
});
