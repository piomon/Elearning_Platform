// ============================================================================
// Wspólne definicje dla eksportu/importu treści e-learningu.
//
// JEDNO źródło prawdy dla obu skryptów (export-content.ts, import-content.ts),
// aby lista tabel, ich kolejność (rodzic-przed-dzieckiem) oraz klucze naturalne
// nigdy się nie rozjechały.
//
// ZASADA BEZPIECZEŃSTWA: eksport działa na LIŚCIE DOZWOLONYCH tabel (allowlist)
// poniżej. Dzięki temu dane wrażliwe (konta, płatności, dostępy, postępy, PII)
// NIGDY nie trafiają do eksportu — nawet przez pomyłkę.
// ============================================================================
import * as schema from "../../../lib/db/src/schema/index.js";

export type TableName =
  | "courses"
  | "sections"
  | "topics"
  | "videos"
  | "lesson_images"
  | "quizzes"
  | "quiz_questions"
  | "quiz_answers"
  | "tasks"
  | "landing_sections"
  | "faq_items"
  | "seo_settings"
  | "ai_settings"
  | "pricing_settings"
  | "platform_settings";

export interface ExportTable {
  name: TableName;
  // Drizzle table object. Typ celowo luźny — kształt generyka Drizzle jest
  // skomplikowany, a skrypty i tak używają go tylko do select/insert/update.
  table: any;
}

// Kolejność RODZIC-PRZED-DZIECKIEM — deterministyczny eksport i import.
// Treść kursu najpierw (kursy → działy → lekcje → materiały), potem ustawienia.
export const EXPORT_TABLES: ExportTable[] = [
  { name: "courses", table: schema.courses },
  { name: "sections", table: schema.sections },
  { name: "topics", table: schema.topics },
  { name: "videos", table: schema.videos },
  { name: "lesson_images", table: schema.lessonImages },
  { name: "quizzes", table: schema.quizzes },
  { name: "quiz_questions", table: schema.quizQuestions },
  { name: "quiz_answers", table: schema.quizAnswers },
  { name: "tasks", table: schema.tasks },
  { name: "landing_sections", table: schema.landingSections },
  { name: "faq_items", table: schema.faqItems },
  { name: "seo_settings", table: schema.seoSettings },
  { name: "ai_settings", table: schema.aiSettings },
  { name: "pricing_settings", table: schema.pricingSettings },
  { name: "platform_settings", table: schema.platformSettings },
];

// Tabele, których NIGDY nie eksportujemy (dane osób, płatności, postępy).
// Lista informacyjna — realną gwarancją jest allowlist EXPORT_TABLES powyżej.
export const EXCLUDED_TABLES = [
  "users",
  "payments",
  "payment_refunds",
  "access_grants",
  "discount_codes",
  "discount_code_uses",
  "learning_progress",
  "video_progress",
  "quiz_attempts",
  "quiz_attempt_answers",
  "ai_checks",
  "contact_submissions",
] as const;

// ── Klucze naturalne (stabilne identyfikatory biznesowe) ────────────────────
// Import dopasowuje wiersze po tych kluczach (a NIE po id z bazy Replit, bo id
// na VPS będą inne). Używane wyłącznie przez import-content.ts, tu trzymane, by
// definicja była w jednym miejscu.

// Wideo w obrębie lekcji: preferuj oryginalny token Bunny (najstabilniejszy),
// potem URL, na końcu tytuł.
export function videoNaturalKey(row: {
  bunnyTitle?: string | null;
  videoUrl?: string | null;
  title?: string | null;
}): string {
  return (row.bunnyTitle || row.videoUrl || row.title || "").trim();
}

export function imageNaturalKey(row: { imageUrl: string }): string {
  return row.imageUrl.trim();
}

export function quizNaturalKey(row: { title: string }): string {
  return row.title.trim();
}

export function taskNaturalKey(row: { title: string }): string {
  return row.title.trim();
}

// Pytanie w obrębie quizu — pozycja (sortOrder). Zmiana treści pytania nie
// tworzy duplikatu; zmiana kolejności może — to udokumentowane ograniczenie.
export function questionNaturalKey(row: { sortOrder: number }): number {
  return row.sortOrder;
}

// Odpowiedź w obrębie pytania — etykieta (A/B/C/D) jest stabilna.
export function answerNaturalKey(row: { answerLabel: string }): string {
  return row.answerLabel.trim().toUpperCase();
}
