import { describe, it, expect, beforeAll } from "vitest";
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
// To gwarancja, że treść e-learningu przetrwa wdrożenie i jest spójna.
describe("Cykl życia treści E2E: import → eksport → content:migrate → verify", () => {
  const tmpExport = mkdtempSync(path.join(os.tmpdir(), "elearning-export-"));
  const tmpMigrations = mkdtempSync(path.join(os.tmpdir(), "content-migrations-"));

  beforeAll(async () => {
    // Dziennik migracji treści nie jest czyszczony przez per-test TRUNCATE —
    // czyścimy go tu jawnie, by test był deterministyczny niezależnie od kolejności.
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
  });

  it("importuje treść z repo i wypełnia rdzeń bazy", () => {
    runScript("import:elearning", ["--mode=merge"]);
  }, 60000);

  it("rdzeń treści nie jest pusty po imporcie", async () => {
    expect(await count("courses")).toBeGreaterThan(0);
    expect(await count("sections")).toBeGreaterThan(0);
    expect(await count("topics")).toBeGreaterThan(0);
    expect(await count("tasks")).toBeGreaterThan(0);
    expect(await count("videos")).toBeGreaterThan(0);
  });

  it("eksportuje do katalogu tymczasowego (pliki JSON powstają)", () => {
    runScript("export:elearning", [], { EXPORT_DIR: tmpExport });
    const combined = path.join(tmpExport, "full-elearning-export.json");
    expect(existsSync(combined)).toBe(true);
    const parsed = JSON.parse(readFileSync(combined, "utf8"));
    expect(Array.isArray(parsed.courses)).toBe(true);
    expect(parsed.courses.length).toBeGreaterThan(0);
  }, 60000);

  it("ponowny import z eksportu jest idempotentny (bez duplikatów)", async () => {
    const before = await count("courses");
    runScript("import:elearning", ["--mode=merge"], { EXPORT_DIR: tmpExport });
    const after = await count("courses");
    expect(after).toBe(before);
  }, 60000);

  it("content:migrate stosuje migrację i zapisuje ją w dzienniku", async () => {
    runScript("content:migrate", [], { CONTENT_MIGRATIONS_DIR: tmpMigrations });
    const { rows } = await pool.query(
      "select name, status, details_json from content_migrations where name = $1",
      ["e2e-0001-count-courses"],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("applied");
    expect(rows[0].details_json?.courses).toBeGreaterThan(0);
  }, 60000);

  it("ponowne content:migrate pomija już zastosowaną migrację", async () => {
    const out = runScript("content:migrate", [], { CONTENT_MIGRATIONS_DIR: tmpMigrations });
    expect(out).toMatch(/pominięta|pominięto/);
    const { rows } = await pool.query(
      "select count(*)::int as n from content_migrations where name = $1",
      ["e2e-0001-count-courses"],
    );
    expect(rows[0].n).toBe(1);
  }, 60000);

  it("verify:content przechodzi na kompletnej bazie (kod wyjścia 0)", () => {
    const out = runScript("verify:content", [], { BUNNY_LIBRARY_ID: "test-library" });
    expect(out).toMatch(/WYNIK: OK/);
  }, 60000);
});
