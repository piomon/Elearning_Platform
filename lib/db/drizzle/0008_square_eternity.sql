CREATE TABLE "discount_code_uses" (
	"id" serial PRIMARY KEY NOT NULL,
	"discount_code_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"payment_id" integer,
	"course_id" integer,
	"amount_before_grosz" integer NOT NULL,
	"discount_grosz" integer NOT NULL,
	"amount_after_grosz" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text DEFAULT 'percent' NOT NULL,
	"value" integer NOT NULL,
	"course_id" integer,
	"valid_from" timestamp,
	"valid_to" timestamp,
	"max_uses" integer,
	"max_uses_per_user" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_admin_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "discount_code_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "discount_grosz" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_code_uses" ADD CONSTRAINT "discount_code_uses_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_code_uses" ADD CONSTRAINT "discount_code_uses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_code_uses" ADD CONSTRAINT "discount_code_uses_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_code_uses" ADD CONSTRAINT "discount_code_uses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_created_by_admin_id_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discount_code_uses_code_idx" ON "discount_code_uses" USING btree ("discount_code_id");--> statement-breakpoint
CREATE INDEX "discount_code_uses_user_idx" ON "discount_code_uses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_code_uniq" ON "discount_codes" USING btree ("code");