import { afterAll, beforeEach } from "vitest";
import { pool } from "@workspace/db";

// Every table, listed so the truncate is explicit. RESTART IDENTITY keeps
// serial ids deterministic per test; CASCADE covers FK dependencies.
const TABLES = [
  "ai_checks",
  "quiz_attempt_answers",
  "quiz_attempts",
  "learning_progress",
  "payment_refunds",
  "access_grants",
  "payments",
  "login_events",
  "admin_logs",
  "contact_messages",
  "tasks",
  "quiz_answers",
  "quiz_questions",
  "quizzes",
  "videos",
  "topics",
  "sections",
  "courses",
  "users",
];

beforeEach(async () => {
  await pool.query(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await pool.end();
});
