// ============================================================================
// EKSPORT treści e-learningu z bazy (uruchamiany na Replit).
//
// Odczytuje z bazy WYŁĄCZNIE tabele treści (allowlist w content-io/tables.ts)
// i zapisuje je do katalogu `scripts/data/export/` jako pliki JSON, które MOŻNA
// commitować do GitHuba. Dzięki temu treść utworzona w panelu administratora
// (która żyje tylko w bazie) trafia do repozytorium i może zostać odtworzona na VPS.
//
// NIE eksportuje: kont użytkowników, płatności, dostępów, postępów, prób quizów
// ani żadnych sekretów (klucze API Bunny/Gemini żyją tylko w ENV, nigdy w bazie).
//
// Użycie:   pnpm --filter @workspace/scripts run export:elearning
// Wynik:    scripts/data/export/<tabela>.json, scripts/data/export/full-elearning-export.json,
//           scripts/data/export/bunny-videos.json (podsumowanie), scripts/data/export/manifest.json
// ============================================================================
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import * as schema from "../../lib/db/src/schema/index.js";
import { EXPORT_TABLES, EXCLUDED_TABLES } from "./content-io/tables.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nie jest ustawione");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/src → scripts/data/export. Nadpisywalne przez ENV (używane w testach).
const EXPORT_DIR = process.env.EXPORT_DIR
  ? resolve(process.env.EXPORT_DIR)
  : join(__dirname, "../data/export");

function writeJson(file: string, data: unknown): void {
  writeFileSync(join(EXPORT_DIR, file), JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function main() {
  console.log("==> Eksportuję treść e-learningu z bazy...");
  mkdirSync(EXPORT_DIR, { recursive: true });

  const counts: Record<string, number> = {};
  const combined: Record<string, unknown> = {};

  for (const { name, table } of EXPORT_TABLES) {
    const rows = await db.select().from(table);
    counts[name] = rows.length;
    combined[name] = rows;
    writeJson(`${name}.json`, rows);
    console.log(`   • ${name}: ${rows.length}`);
  }

  // Czytelne podsumowanie powiązań z Bunny.net (dział → lekcja → wideo → GUID),
  // aby łatwo zweryfikować integrację wideo bez czytania surowego dumpu.
  const sections = combined["sections"] as any[];
  const topics = combined["topics"] as any[];
  const videos = combined["videos"] as any[];
  const secById = new Map(sections.map((s) => [s.id, s]));
  const topById = new Map(topics.map((t) => [t.id, t]));
  const bunnySummary = videos.map((v) => {
    const topic = topById.get(v.topicId);
    const section = topic ? secById.get(topic.sectionId) : undefined;
    return {
      section: section?.title ?? null,
      topic: topic?.title ?? null,
      videoTitle: v.title,
      bunnyVideoId: v.bunnyVideoId,
      bunnyTitle: v.bunnyTitle,
      videoUrl: v.videoUrl,
    };
  });
  writeJson("bunny-videos.json", bunnySummary);

  const withBunny = videos.filter((v) => v.bunnyVideoId || v.videoUrl).length;

  const meta = {
    exportedAt: new Date().toISOString(),
    source: "replit-database",
    counts,
    excludedTables: EXCLUDED_TABLES,
    videosWithBunnyRef: withBunny,
    videosTotal: videos.length,
    note:
      "Eksport zawiera WYŁĄCZNIE treść e-learningu (kursy/działy/lekcje/materiały/quizy/zadania/ustawienia). " +
      "NIE zawiera kont, płatności, dostępów, postępów ani sekretów. Można commitować do GitHuba.",
  };
  combined["meta"] = meta;

  writeJson("full-elearning-export.json", combined);
  writeJson("manifest.json", meta);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\n==> Gotowe. Zapisano ${total} wierszy do katalogu scripts/data/export/.`);
  console.log(`   Wideo z powiązaniem Bunny.net: ${withBunny}/${videos.length}`);
  console.log(
    "   Zacommituj katalog scripts/data/export/ do GitHuba, a następnie na VPS uruchom import.",
  );
  await pool.end();
}

main().catch(async (err) => {
  console.error("BŁĄD eksportu:", err);
  await pool.end();
  process.exit(1);
});
