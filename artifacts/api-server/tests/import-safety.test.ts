import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "@workspace/db";
import { db, users, payments, accessGrants, learningProgress } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createUser, seedCourse, grantAccess } from "./helpers/factories";

// scripts/src lives three levels up from artifacts/api-server/tests.
const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const scriptsSrc = path.join(repoRoot, "scripts", "src");

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

// Tables that hold CUSTOMER data. The importer may READ them (e.g. the
// replace-demo-content safety guard counts them), but must NEVER delete or
// truncate them — those rows are irreplaceable and are excluded from exports.
const PROTECTED = [
  { variable: "users", table: "users" },
  { variable: "payments", table: "payments" },
  { variable: "paymentRefunds", table: "payment_refunds" },
  { variable: "accessGrants", table: "access_grants" },
  { variable: "learningProgress", table: "learning_progress" },
  { variable: "videoProgress", table: "video_progress" },
  { variable: "quizAttempts", table: "quiz_attempts" },
  { variable: "quizAttemptAnswers", table: "quiz_attempt_answers" },
  { variable: "aiChecks", table: "ai_checks" },
  { variable: "loginEvents", table: "login_events" },
  { variable: "adminLogs", table: "admin_logs" },
  { variable: "contactMessages", table: "contact_messages" },
  { variable: "discountCodes", table: "discount_codes" },
  { variable: "discountCodeUses", table: "discount_code_uses" },
];

// ── Skan statyczny: udowadnia bez uruchamiania, że importer nie zawiera
// żadnej destrukcyjnej operacji na tabelach z danymi klientów. ────────────────
describe("Importer nie kasuje danych klientów (skan statyczny)", () => {
  const source = readFileSync(path.join(scriptsSrc, "import-elearning.ts"), "utf8");

  it("nie zawiera TRUNCATE ani DROP TABLE", () => {
    expect(/\btruncate\b/i.test(source)).toBe(false);
    expect(/\bdrop\s+table\b/i.test(source)).toBe(false);
  });

  it.each(PROTECTED)("nie wykonuje .delete($variable) ani DELETE FROM $table", ({ variable, table }) => {
    const drizzleDelete = new RegExp(`\\.delete\\(\\s*${variable}\\b`);
    const rawDelete = new RegExp(`delete\\s+from\\s+"?${table}"?`, "i");
    expect(drizzleDelete.test(source), `znaleziono .delete(${variable})`).toBe(false);
    expect(rawDelete.test(source), `znaleziono DELETE FROM ${table}`).toBe(false);
  });
});

// ── Test wykonawczy: prawdziwy import (merge) na żywej bazie testowej nie
// narusza wcześniej istniejących danych klientów. ────────────────────────────
describe("Importer (merge) zachowuje dane klientów", () => {
  it("po imporcie użytkownik, płatność, dostęp i postęp nadal istnieją", async () => {
    const { user } = await createUser();
    const { course, topic } = await seedCourse();
    const grant = await grantAccess(user.id, course.id);

    const [payment] = await db
      .insert(payments)
      .values({ userId: user.id, amount: 3500, currency: "PLN", status: "completed", courseId: course.id })
      .returning();

    const [progress] = await db
      .insert(learningProgress)
      .values({ userId: user.id, courseId: course.id, topicId: topic.id, currentElementType: "video" })
      .returning();

    // Prawdziwy import treści z repo (scripts/data/export) w trybie merge.
    runScript("import:elearning", ["--mode=merge"]);

    const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const [p] = await db.select().from(payments).where(eq(payments.id, payment.id)).limit(1);
    const [g] = await db.select().from(accessGrants).where(eq(accessGrants.id, grant.id)).limit(1);
    const [pr] = await db
      .select()
      .from(learningProgress)
      .where(eq(learningProgress.id, progress.id))
      .limit(1);

    expect(u?.id).toBe(user.id);
    expect(p?.id).toBe(payment.id);
    expect(p?.amount).toBe(3500);
    expect(p?.status).toBe("completed");
    expect(g?.id).toBe(grant.id);
    expect(pr?.id).toBe(progress.id);

    // A import faktycznie dodał treść (sanity — merge nie był no-opem).
    const { rows } = await pool.query("select count(*)::int as n from courses");
    expect(rows[0].n).toBeGreaterThan(1);
  }, 60000);
});
