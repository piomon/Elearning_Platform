CREATE TYPE "public"."lesson_access_type" AS ENUM('free', 'paid', 'admin');--> statement-breakpoint
CREATE TYPE "public"."lesson_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"model" text DEFAULT 'gemini-1.5-flash' NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"eval_instruction" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"max_response_length" integer DEFAULT 0 NOT NULL,
	"error_message" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "explanation" text;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "points" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "pass_threshold" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "max_attempts" integer;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "time_limit_minutes" integer;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "shuffle_questions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "shuffle_answers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "show_score" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "show_correct_answers" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "objectives" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "difficulty" "lesson_difficulty";--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "access_type" "lesson_access_type" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "meta_title" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "meta_description" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "ai_enabled" boolean DEFAULT true NOT NULL;