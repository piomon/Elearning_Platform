ALTER TABLE "ai_settings" ALTER COLUMN "model" SET DEFAULT '';--> statement-breakpoint
UPDATE "ai_settings" SET "model" = '' WHERE "model" ~* '^(models/)?gemini-(pro|1\.[05]|2\.0-flash)';
