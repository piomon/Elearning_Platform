CREATE TYPE "public"."publish_status" AS ENUM('draft', 'published', 'hidden', 'archived');--> statement-breakpoint
CREATE TABLE "faq_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"content" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "landing_sections_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "pricing_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"price_grosz" integer DEFAULT 3500 NOT NULL,
	"old_price_grosz" integer DEFAULT 19900 NOT NULL,
	"currency" text DEFAULT 'PLN' NOT NULL,
	"promo_enabled" boolean DEFAULT true NOT NULL,
	"promo_label" text DEFAULT '' NOT NULL,
	"promo_starts_at" timestamp,
	"promo_ends_at" timestamp,
	"cta_text" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"meta_title" text DEFAULT '' NOT NULL,
	"meta_description" text DEFAULT '' NOT NULL,
	"og_title" text DEFAULT '' NOT NULL,
	"og_description" text DEFAULT '' NOT NULL,
	"og_image" text DEFAULT '' NOT NULL,
	"canonical_url" text DEFAULT '' NOT NULL,
	"robots" text DEFAULT 'index, follow' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "status" "publish_status" DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "status" "publish_status" DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "status" "publish_status" DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "status" "publish_status" DEFAULT 'published' NOT NULL;