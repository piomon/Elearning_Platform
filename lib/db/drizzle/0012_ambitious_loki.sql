CREATE TABLE "content_migrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" text DEFAULT '1' NOT NULL,
	"checksum" text NOT NULL,
	"status" text DEFAULT 'applied' NOT NULL,
	"applied_by" text DEFAULT 'content:migrate' NOT NULL,
	"details_json" jsonb,
	"applied_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "content_migrations_name_uniq" ON "content_migrations" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_course_id_slug_uniq" ON "sections" USING btree ("course_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_topic_id_title_uniq" ON "tasks" USING btree ("topic_id","title");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_section_id_slug_uniq" ON "topics" USING btree ("section_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "videos_bunny_video_id_uniq" ON "videos" USING btree ("bunny_video_id");