ALTER TABLE "login_events" ALTER COLUMN "user_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "admin_logs" ALTER COLUMN "metadata_json" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "consent_at" timestamp;--> statement-breakpoint
CREATE INDEX "access_grants_user_course_status_idx" ON "access_grants" USING btree ("user_id","course_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "access_grants_active_user_course_uniq" ON "access_grants" USING btree ("user_id","course_id") WHERE "access_grants"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_id_uniq" ON "payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "payments_user_status_idx" ON "payments" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_progress_user_topic_uniq" ON "learning_progress" USING btree ("user_id","topic_id");