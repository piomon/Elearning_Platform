// ============================================================================
// URUCHAMIACZ migracji TREŚCI (jednorazowych transformacji danych), uruchamiany
// na VPS PO imporcie treści. Dziennik trzymany jest w tabeli content_migrations —
// migracja o danej nazwie jest stosowana DOKŁADNIE RAZ (wiersz zapisywany
// dopiero po udanym up()). Jest to mechanizm ODRĘBNY od migracji SCHEMATU
// (lib/db/drizzle/*.sql, obsługiwanych przez `drizzle-kit migrate`).
//
// Migracja = plik w scripts/content-migrations/<nazwa>.ts eksportujący:
//   export const name = "0001-krotki-opis";           // opcjonalne (domyślnie = nazwa pliku)
//   export async function up(ctx): Promise<unknown>;   // zwraca detale do dziennika
// gdzie ctx = { tx, db, schema }. up() działa W TRANSAKCJI — błąd = pełny rollback,
// a wiersz w content_migrations NIE zostaje zapisany (więc przy następnym
// uruchomieniu migracja spróbuje ponownie).
//
// Kolejność: pliki sortowane leksykograficznie po nazwie (stąd prefiks 0001, 0002…).
//
// Użycie:  pnpm --filter @workspace/scripts run content:migrate
//          pnpm --filter @workspace/scripts run content:migrate -- --dry-run
// ============================================================================
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve, basename } from "node:path";
import * as schema from "../../lib/db/src/schema/index.js";

const { Pool } = pg;
const { contentMigrations } = schema;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nie jest ustawione");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const __dirname = dirname(fileURLToPath(import.meta.url));
// Domyślnie scripts/content-migrations; nadpisywalne przez ENV (używane w testach).
const MIGRATIONS_DIR = process.env.CONTENT_MIGRATIONS_DIR
  ? resolve(process.env.CONTENT_MIGRATIONS_DIR)
  : join(__dirname, "../content-migrations");

const dryRun = process.argv.slice(2).includes("--dry-run");

export interface ContentMigrationContext {
  tx: any;
  db: any;
  schema: typeof schema;
}

interface LoadedMigration {
  name: string;
  file: string;
  checksum: string;
  up: (ctx: ContentMigrationContext) => Promise<unknown>;
}

const MIGRATION_FILE = /\.(ts|mts|cts|js|mjs|cjs)$/;

async function loadMigrations(): Promise<LoadedMigration[]> {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => MIGRATION_FILE.test(f) && !f.endsWith(".d.ts"))
    .sort();
  const out: LoadedMigration[] = [];
  for (const f of files) {
    const full = join(MIGRATIONS_DIR, f);
    const mod = await import(pathToFileURL(full).href);
    if (typeof mod.up !== "function") {
      throw new Error(`Migracja treści ${f} nie eksportuje funkcji up().`);
    }
    const name = (mod.name as string) || basename(f).replace(MIGRATION_FILE, "");
    const checksum = createHash("sha256").update(readFileSync(full)).digest("hex");
    out.push({ name, file: f, checksum, up: mod.up });
  }
  return out;
}

async function main() {
  console.log(`==> Migracje treści${dryRun ? " (DRY-RUN)" : ""}. Katalog: ${MIGRATIONS_DIR}`);
  const migrations = await loadMigrations();

  if (migrations.length === 0) {
    console.log("   Brak migracji treści do uruchomienia.");
    await pool.end();
    return;
  }

  // Dwie migracje o tej samej nazwie zaburzyłyby dziennik — to błąd konfiguracji.
  const seen = new Set<string>();
  for (const m of migrations) {
    if (seen.has(m.name)) throw new Error(`Zduplikowana nazwa migracji treści: ${m.name}`);
    seen.add(m.name);
  }

  let applied = 0;
  let skipped = 0;

  for (const m of migrations) {
    const [row] = await db
      .select()
      .from(contentMigrations)
      .where(eq(contentMigrations.name, m.name))
      .limit(1);

    if (row) {
      if (row.checksum !== m.checksum) {
        console.warn(
          `   ⚠️  ${m.name}: już zastosowana, ale suma kontrolna pliku różni się od zapisanej ` +
            "(plik zmieniono po zastosowaniu). NIE uruchamiam ponownie — utwórz nową migrację.",
        );
      } else {
        console.log(`   • ${m.name}: pominięta (już zastosowana).`);
      }
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`   • ${m.name}: DO ZASTOSOWANIA (dry-run — nie uruchamiam).`);
      applied += 1;
      continue;
    }

    // up() ORAZ zapis wiersza w JEDNEJ transakcji — albo oba, albo nic.
    const details = await db.transaction(async (tx: any) => {
      const d = await m.up({ tx, db, schema });
      await tx.insert(contentMigrations).values({
        name: m.name,
        checksum: m.checksum,
        status: "applied",
        appliedBy: "content:migrate",
        detailsJson: (d ?? null) as any,
      });
      return d;
    });
    console.log(`   ✓ ${m.name}: zastosowana.`, details ? JSON.stringify(details) : "");
    applied += 1;
  }

  console.log(
    `\n==> Gotowe. ${dryRun ? "Do zastosowania" : "Zastosowano"}: ${applied}, pominięto: ${skipped}.`,
  );
  await pool.end();
}

main().catch(async (err) => {
  console.error("BŁĄD migracji treści:", err?.message ?? err);
  await pool.end();
  process.exit(1);
});
