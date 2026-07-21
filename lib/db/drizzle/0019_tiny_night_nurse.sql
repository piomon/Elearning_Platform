CREATE TABLE "ai_usage_daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"operation" text NOT NULL,
	"model" text NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"completed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"rescued_by_retry" integer DEFAULT 0 NOT NULL,
	"transient_429" integer DEFAULT 0 NOT NULL,
	"transient_503" integer DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"est_cost_grosz" numeric(14, 6) DEFAULT '0' NOT NULL,
	"latency_ms_sum" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_daily_stats_day_op_model_idx" ON "ai_usage_daily_stats" USING btree ("day","operation","model");