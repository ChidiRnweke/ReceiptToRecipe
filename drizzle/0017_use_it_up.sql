CREATE TABLE "household_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"kind" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "needs_you_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"answer" text NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "needs_you_answers_household_user_key_unique" UNIQUE("household_id","user_id","key")
);
--> statement-breakpoint
ALTER TABLE "household_events" ADD CONSTRAINT "household_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_events" ADD CONSTRAINT "household_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs_you_answers" ADD CONSTRAINT "needs_you_answers_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs_you_answers" ADD CONSTRAINT "needs_you_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "household_events_household_created_idx" ON "household_events" USING btree ("household_id","created_at");--> statement-breakpoint
-- BEGIN HAND-WRITTEN
-- Purchases already in the log get the name people know the item by: the receipt line's
-- normalized name, or the name of the cupboard row it was entered as. Events that already carry
-- a name keep it.
UPDATE "kitchen_events" AS ke
SET "payload" = coalesce(ke."payload", '{}'::jsonb) || jsonb_build_object('name', btrim(ri."normalized_name"))
FROM "receipt_items" AS ri
WHERE ke."receipt_item_id" = ri."id"
	AND ke."kind" = 'BOUGHT'
	AND (ke."payload" IS NULL OR NOT ke."payload" ? 'name')
	AND btrim(ri."normalized_name") <> '';
--> statement-breakpoint
UPDATE "kitchen_events" AS ke
SET "payload" = coalesce(ke."payload", '{}'::jsonb) || jsonb_build_object('name', btrim(ci."item_name"))
FROM "cupboard_items" AS ci
WHERE ke."cupboard_item_id" = ci."id"
	AND ke."kind" IN ('BOUGHT', 'CORRECTED_QUANTITY')
	AND (ke."payload" IS NULL OR NOT ke."payload" ? 'name')
	AND btrim(ci."item_name") <> '';
-- END HAND-WRITTEN
