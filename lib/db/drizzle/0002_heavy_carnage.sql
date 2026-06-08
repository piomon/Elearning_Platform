ALTER TABLE "tasks" ALTER COLUMN "ai_prompt_config" SET DATA TYPE jsonb USING "ai_prompt_config"::jsonb;--> statement-breakpoint
ALTER TABLE "ai_checks" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "ai_checks" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "ai_checks" ADD COLUMN "request_bytes" integer;--> statement-breakpoint
ALTER TABLE "ai_checks" ADD COLUMN "latency_ms" integer;