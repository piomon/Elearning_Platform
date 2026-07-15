CREATE TABLE "ai_usage_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"operation" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"http_status" integer,
	"attempts" integer DEFAULT 1 NOT NULL,
	"rescued_by_retry" boolean DEFAULT false NOT NULL,
	"transient_429" integer DEFAULT 0 NOT NULL,
	"transient_503" integer DEFAULT 0 NOT NULL,
	"attempt_log" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"est_cost_grosz" numeric(12, 6),
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_log_operation_created_at_idx" ON "ai_usage_log" USING btree ("operation","created_at");