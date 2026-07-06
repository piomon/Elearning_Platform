import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { pool } from "@workspace/db";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

function runScript(scriptName: string, args: string[] = [], extraEnv: Record<string, string> = {}) {
  try {
    return execFileSync(
      "pnpm",
      ["--filter", "@workspace/scripts", "run", scriptName, ...args],
      { cwd: repoRoot, env: { ...process.env, ...extraEnv }, encoding: "utf8", stdio: "pipe" },
    );
  } catch (e: any) {
    throw new Error(
      `Skrypt "${scriptName}" zakończył się błędem:\n--- stdout ---\n${e.stdout ?? ""}\n--- stderr ---\n${e.stderr ?? ""}`,
    );
  }
}

async function count(table: string): Promise<number> {
  const { rows } = await pool.query(`select count(*)::int as n from ${table}`);
  return rows[0].n as number;
}

// Pełny cykl życia danych treści na żywej bazie testowej:
//   import (repo) -> eksport (temp) -> ponowny import (temp, idempotencja)
//   -> migracje treści (temp, dziennik) -> walidacja.
//
// UWAGA: cały scenariusz jest JEDNYM testem, bo globalny beforeEach (setup.ts)
// czyści tabele treści przed KAŻDYM `it` — rozbicie na wiele `it` zerowałoby
// stan między krokami.
describe("Cykl życia treści E2E", () => {
  it("import → eksport → ponowny import → content:migrate → verify", async () => {
    const tmpExport = mkdtempSync(path.join(os.tmpdir(), "elearning-export-"));
    const tmpMigrations = mkdtempSync(path.join(os.tmpdir(), "content-migrations-"));

    // Dziennik migracji treści nie jest czyszczony przez per-test TRUNCATE.
    await pool.query("DELETE FROM content_migrations");

    // Tymczasowa migracja treści (read-only) — dowodzi mechanizmu dziennika.
    writeFileSync(
      path.join(tmpMigrations, "0001-e2e-count-courses.ts"),
      [
        'export const name = "e2e-0001-count-courses";',
        "export async function up(ctx: any) {",
        "  const rows = await ctx.tx.select().from(ctx.schema.courses);",
        "  return { courses: rows.length };",
        "}",
        "",
      ].join("\n"),
    );

    // 1) Import treści z repo (scripts/data/export) — wypełnia rdzeń bazy.
    runScript("import:elearning", ["--mode=merge"]);
    expect(await count("courses")).toBeGreaterThan(0);
    expect(await count("sections")).toBeGreaterThan(0);
    expect(await count("topics")).toBeGreaterThan(0);
    expect(await count("tasks")).toBeGreaterThan(0);
    expect(await count("videos")).toBeGreaterThan(0);

    // 2) Eksport do katalogu tymczasowego — pliki JSON powstają i nie są puste.
    runScript("export:elearning", [], { EXPORT_DIR: tmpExport });
    const combined = path.join(tmpExport, "full-elearning-export.json");
    expect(existsSync(combined)).toBe(true);
    const parsed = JSON.parse(readFileSync(combined, "utf8"));
    expect(Array.isArray(parsed.courses)).toBe(true);
    expect(parsed.courses.length).toBeGreaterThan(0);

    // 3) Ponowny import z eksportu — idempotentny (bez duplikatów kursów).
    const beforeCourses = await count("courses");
    runScript("import:elearning", ["--mode=merge"], { EXPORT_DIR: tmpExport });
    expect(await count("courses")).toBe(beforeCourses);

    // 4) content:migrate — stosuje migrację i zapisuje ją w dzienniku.
    runScript("content:migrate", [], { CONTENT_MIGRATIONS_DIR: tmpMigrations });
    const applied = await pool.query(
      "select name, status, details_json from content_migrations where name = $1",
      ["e2e-0001-count-courses"],
    );
    expect(applied.rows.length).toBe(1);
    expect(applied.rows[0].status).toBe("applied");
    expect(applied.rows[0].details_json?.courses).toBeGreaterThan(0);

    // 5) Ponowne content:migrate — migracja jest pomijana (dokładnie raz).
    const rerun = runScript("content:migrate", [], { CONTENT_MIGRATIONS_DIR: tmpMigrations });
    expect(rerun).toMatch(/pominięta|pominięto/);
    const still = await pool.query(
      "select count(*)::int as n from content_migrations where name = $1",
      ["e2e-0001-count-courses"],
    );
    expect(still.rows[0].n).toBe(1);

    // 6) verify:content — przechodzi na kompletnej bazie (kod wyjścia 0).
    const verifyOut = runScript("verify:content", [], { BUNNY_LIBRARY_ID: "test-library" });
    expect(verifyOut).toMatch(/WYNIK: OK/);
  }, 180000);
});
