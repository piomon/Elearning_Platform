import { pgTable, serial, text, boolean, integer, timestamp, jsonb, pgEnum, uniqueIndex, index, numeric } from "drizzle-orm/pg-core";
import { users } from "./users";

// Publication lifecycle for educational content. `published` is the only state
// the public/student side may see; `draft`/`hidden`/`archived` are admin-only.
// Default is `published` so pre-existing rows stay visible after the migration.
export const publishStatusEnum = pgEnum("publish_status", ["draft", "published", "hidden", "archived"]);

// Lesson difficulty shown in the editor and (optionally) to students.
export const lessonDifficultyEnum = pgEnum("lesson_difficulty", ["easy", "medium", "hard"]);

// Who may access a lesson: a free preview, the paid course, or admin-only
// (work in progress). `isPreview` is kept in sync (free => preview) so the
// existing server-side access checks keep working unchanged.
export const lessonAccessTypeEnum = pgEnum("lesson_access_type", ["free", "paid", "admin"]);

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  // `status` is the authoritative visibility source. `isPublished` is kept in
  // sync on writes (status === 'published') only for backward compatibility.
  status: publishStatusEnum("status").notNull().default("published"),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sections = pgTable("sections", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  bunnyCollectionId: text("bunny_collection_id"),
  status: publishStatusEnum("status").notNull().default("published"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // A section slug is unique within its course; this is the natural key the
  // content importer upserts on, and it prevents duplicate sections on re-import.
  uniqueIndex("sections_course_id_slug_uniq").on(table.courseId, table.slug),
]);

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  // Longer, structured learning objectives shown in the lesson editor.
  objectives: text("objectives"),
  durationMinutes: integer("duration_minutes"),
  difficulty: lessonDifficultyEnum("difficulty"),
  // Authoritative access intent picked in the editor. `isPreview` below is kept
  // in sync (free => preview) so existing access checks need no changes.
  accessType: lessonAccessTypeEnum("access_type").notNull().default("paid"),
  thumbnailUrl: text("thumbnail_url"),
  // Per-lesson SEO overrides (lesson tab "SEO").
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  // Per-lesson AI kill switch; combined with the global aiSettings.enabled flag.
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // When true the lesson is a free preview accessible without a paid grant.
  // Access is still enforced server-side; this only widens what is allowed.
  isPreview: boolean("is_preview").notNull().default(false),
  status: publishStatusEnum("status").notNull().default("published"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // A topic (lesson) slug is unique within its section — the importer's natural
  // key. Guards against duplicate lessons if an import runs more than once.
  uniqueIndex("topics_section_id_slug_uniq").on(table.sectionId, table.slug),
]);

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  bunnyVideoId: text("bunny_video_id"),
  // Original Bunny title token (e.g. D1_L01_01_VIDEO_...) used to re-sync GUIDs.
  bunnyTitle: text("bunny_title"),
  videoUrl: text("video_url"),
  title: text("title").notNull(),
  durationSeconds: integer("duration_seconds"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // A Bunny.net video GUID maps to exactly one video row, so re-importing the
  // same export never duplicates a clip. NULL is allowed for videos not yet
  // linked to Bunny (Postgres treats NULLs as distinct in a unique index).
  uniqueIndex("videos_bunny_video_id_uniq").on(table.bunnyVideoId),
]);

// Static images interleaved into a lesson (answer keys, diagrams). Ordered with
// videos by sortOrder so the lesson renders materials in the intended sequence.
export const lessonImages = pgTable("lesson_images", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  // The task/question text (used both as the img alt and the visible caption).
  alt: text("alt"),
  // Task-card fields for exercise images (e.g. Dział 4). The answer and full
  // worked solution are HIDDEN client-side until the student chooses to reveal
  // them, so they must be nullable and are only set for exercise cards.
  answer: text("answer"),
  solution: text("solution"),
  // Bunny title (WITHOUT file extension) of the preceding worked-example video
  // this card refers to. The topic API resolves it to a concrete video id for
  // the "see the worked example" link. Null when the card has no paired video.
  relatedVideoTitle: text("related_video_title"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  // Percentage (0–100) required to pass. Default 80 matches the previous
  // hardcoded threshold so existing quizzes behave identically.
  passThreshold: integer("pass_threshold").notNull().default(80),
  // null = unlimited attempts.
  maxAttempts: integer("max_attempts"),
  // null = no time limit.
  timeLimitMinutes: integer("time_limit_minutes"),
  shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
  shuffleAnswers: boolean("shuffle_answers").notNull().default(false),
  showScore: boolean("show_score").notNull().default(true),
  showCorrectAnswers: boolean("show_correct_answers").notNull().default(true),
  status: publishStatusEnum("status").notNull().default("published"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  // Optional explanation revealed after answering (when the quiz allows it).
  explanation: text("explanation"),
  points: integer("points").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quizAnswers = pgTable("quiz_answers", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  answerLabel: text("answer_label").notNull(),
  answerText: text("answer_text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quizId: integer("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  score: integer("score").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const quizAttemptAnswers = pgTable("quiz_attempt_answers", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => quizQuestions.id),
  selectedAnswerId: integer("selected_answer_id").notNull().references(() => quizAnswers.id),
  isCorrect: boolean("is_correct").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  initialImageUrl: text("initial_image_url"),
  aiPromptConfig: jsonb("ai_prompt_config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Tasks have no slug; their title is unique within a lesson. This is the
  // importer's natural key and prevents duplicate tasks on re-import.
  uniqueIndex("tasks_topic_id_title_uniq").on(table.topicId, table.title),
]);

export const aiChecks = pgTable("ai_checks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: integer("task_id").notNull().references(() => tasks.id),
  topicId: integer("topic_id").references(() => topics.id),
  imageStoragePath: text("image_storage_path"),
  aiResponse: text("ai_response"),
  errorMessage: text("error_message"),
  model: text("model"),
  requestBytes: integer("request_bytes"),
  latencyMs: integer("latency_ms"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Diagnostics + cost accounting for EVERY Gemini call (checks, assistant chat,
// admin tests): attempts, retry rescues, upstream error statuses, token counts
// and estimated cost. Powers the admin AI-usage stats and answers "how many
// requests died on 503 / were saved by retry / what did text queries cost".
// Contains NO prompt or student content — only metadata.
export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    // For "check" operations: the ai_checks row this call produced — photo
    // size, stored AI response and task/topic context live there. Null for
    // chat/admin-test and for legacy rows predating the link.
    aiCheckId: integer("ai_check_id").references(() => aiChecks.id, { onDelete: "set null" }),
    operation: text("operation").notNull(), // "check" | "chat" | "admin-test"
    model: text("model").notNull(),
    status: text("status").notNull(), // "completed" | "failed"
    httpStatus: integer("http_status"), // upstream status of the final failure
    attempts: integer("attempts").notNull().default(1),
    rescuedByRetry: boolean("rescued_by_retry").notNull().default(false),
    transient429: integer("transient_429").notNull().default(0),
    transient503: integer("transient_503").notNull().default(0),
    attemptLog: jsonb("attempt_log"), // [{attempt, ok, httpStatus?, ms, reason?}]
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"), // includes billed "thinking" tokens
    totalTokens: integer("total_tokens"),
    estCostGrosz: numeric("est_cost_grosz", { precision: 12, scale: 6 }),
    latencyMs: integer("latency_ms").notNull().default(0),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_usage_log_operation_created_at_idx").on(table.operation, table.createdAt),
    // The admin log browses newest-first with arbitrary filters; keep the
    // default (unfiltered) listing index-backed as the table grows.
    index("ai_usage_log_created_at_id_idx").on(table.createdAt, table.id),
  ],
);
