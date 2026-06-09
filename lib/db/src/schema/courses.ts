import { pgTable, serial, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  // When true the lesson is a free preview accessible without a paid grant.
  // Access is still enforced server-side; this only widens what is allowed.
  isPreview: boolean("is_preview").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
});

// Static images interleaved into a lesson (answer keys, diagrams). Ordered with
// videos by sortOrder so the lesson renders materials in the intended sequence.
export const lessonImages = pgTable("lesson_images", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  alt: text("alt"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
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
});

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
