import { afterAll, beforeEach, vi } from "vitest";
import { pool } from "@workspace/db";

// Setup files run before each test file's own modules (incl. env.ts) are
// imported, so clearing the Paynow credentials here makes every suite start with
// Paynow deterministically *unconfigured* — payment routes then take the
// dev/test mock branch instead of hitting the real Paynow API (a 502 in CI), no
// matter what PAYNOW_* secrets the host environment injects. The webhook suite
// re-enables Paynow for itself via its own vi.hoisted block.
delete process.env.PAYNOW_API_KEY;
delete process.env.PAYNOW_SIGNATURE_KEY;

// Gemini: tests must never talk to the real API nor inherit host-injected
// models/keys. AI suites mock the SDK and set a fake key via vi.hoisted.
delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_MODEL;
delete process.env.GEMINI_CHAT_MODEL;
delete process.env.AI_FAKE_TRANSIENT_ERRORS;

// The suite exercises the real Express app, so Clerk's Express SDK is mocked
// here once — a vi.mock in a setup file applies to every test file. Tests
// authenticate with `Authorization: Bearer <clerkUserId>`; the mock turns that
// bearer value straight into a Clerk session userId. clerkMiddleware is a no-op,
// and clerkClient.users.getUser must never run because the factories pre-link
// every test user's clerk_user_id (so the JIT sync always hits its fast path).
vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { headers: Record<string, string | undefined> }) => {
    const header = req.headers["authorization"] ?? "";
    const userId = header.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : null;
    return { userId };
  },
  clerkClient: {
    users: {
      getUser: async (id: string) => {
        throw new Error(
          `Unexpected clerkClient.users.getUser('${id}') in tests — ` +
            "the user factory should pre-link clerk_user_id.",
        );
      },
    },
  },
}));

// Every table, listed so the truncate is explicit. RESTART IDENTITY keeps
// serial ids deterministic per test; CASCADE covers FK dependencies.
const TABLES = [
  "landing_sections",
  "faq_items",
  "seo_settings",
  "pricing_settings",
  "ai_checks",
  "ai_usage_log",
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
