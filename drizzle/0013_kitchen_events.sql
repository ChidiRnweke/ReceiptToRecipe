CREATE TYPE "public"."kitchen_event_kind" AS ENUM('BOUGHT', 'COOKED', 'CORRECTED_GONE', 'CORRECTED_STILL_GOOD', 'CORRECTED_QUANTITY', 'SHOP_DONE');--> statement-breakpoint
CREATE TYPE "public"."planned_meal_status" AS ENUM('PLANNED', 'COOKED', 'SKIPPED', 'EATEN_OUT');--> statement-breakpoint
CREATE TYPE "public"."shop_method" AS ENUM('RECEIPT', 'TICK');--> statement-breakpoint
CREATE TABLE "household_habit_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"key" text NOT NULL,
	"answer" text NOT NULL,
	"answered_by" uuid,
	"answered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "household_habit_answers_household_key_unique" UNIQUE("household_id","key")
);
--> statement-breakpoint
CREATE TABLE "kitchen_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"occurred_at" timestamp NOT NULL,
	"kind" "kitchen_event_kind" NOT NULL,
	"item_key" text,
	"quantity" numeric(10, 3),
	"unit" text,
	"expires_at" timestamp,
	"known" boolean DEFAULT true NOT NULL,
	"portions" integer,
	"receipt_item_id" uuid,
	"planned_meal_id" uuid,
	"recipe_id" uuid,
	"cupboard_item_id" uuid,
	"method" "shop_method",
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "time_zone" text DEFAULT 'Europe/Brussels' NOT NULL;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD COLUMN "status" "planned_meal_status" DEFAULT 'PLANNED' NOT NULL;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD COLUMN "servings" integer;--> statement-breakpoint
ALTER TABLE "household_habit_answers" ADD CONSTRAINT "household_habit_answers_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_habit_answers" ADD CONSTRAINT "household_habit_answers_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_events" ADD CONSTRAINT "kitchen_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_events" ADD CONSTRAINT "kitchen_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_events" ADD CONSTRAINT "kitchen_events_receipt_item_id_receipt_items_id_fk" FOREIGN KEY ("receipt_item_id") REFERENCES "public"."receipt_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_events" ADD CONSTRAINT "kitchen_events_planned_meal_id_planned_meals_id_fk" FOREIGN KEY ("planned_meal_id") REFERENCES "public"."planned_meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_events" ADD CONSTRAINT "kitchen_events_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_events" ADD CONSTRAINT "kitchen_events_cupboard_item_id_cupboard_items_id_fk" FOREIGN KEY ("cupboard_item_id") REFERENCES "public"."cupboard_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kitchen_events_household_occurred_idx" ON "kitchen_events" USING btree ("household_id","occurred_at");--> statement-breakpoint
-- BEGIN HAND-WRITTEN
-- Backfill: replay the existing kitchen data as events so the projected picture starts from what
-- the household already recorded. Item keys are trimmed, single-spaced and lower case; the app
-- applies the rest of its item-key rules (punctuation, singular) when it replays the events, so
-- "eggs" stored here merges with "egg" written later. Expiry stays null where only a category is
-- known; the projection derives it from the category's shelf life. A cupboard row's purchase is
-- linked to the row, so deleting the row later takes the purchase back.
INSERT INTO "kitchen_events" ("household_id", "actor_user_id", "occurred_at", "kind", "item_key", "quantity", "unit", "known", "receipt_item_id", "payload")
SELECT r."household_id", r."user_id", COALESCE(r."purchase_date", r."created_at"), 'BOUGHT', lower(regexp_replace(trim(ri."normalized_name"), '\s+', ' ', 'g')), ri."quantity", ri."unit", true, ri."id", jsonb_build_object('category', ri."category", 'source', 'receipt', 'backfilled', true)
FROM "receipt_items" ri JOIN "receipts" r ON r."id" = ri."receipt_id";
--> statement-breakpoint
INSERT INTO "kitchen_events" ("household_id", "actor_user_id", "occurred_at", "kind", "item_key", "quantity", "unit", "expires_at", "known", "cupboard_item_id", "payload")
SELECT c."household_id", c."user_id", c."added_date", 'BOUGHT', lower(regexp_replace(trim(c."item_name"), '\s+', ' ', 'g')), c."quantity", COALESCE(c."unit", 'count'), CASE WHEN c."shelf_life_days" IS NULL THEN NULL ELSE c."added_date" + c."shelf_life_days" * interval '1 day' END, true, c."id", jsonb_build_object('category', c."category", 'source', 'manual', 'backfilled', true)
FROM "cupboard_items" c;
--> statement-breakpoint
INSERT INTO "kitchen_events" ("household_id", "actor_user_id", "occurred_at", "kind", "item_key", "payload")
SELECT c."household_id", c."user_id", c."updated_at", 'CORRECTED_GONE', lower(regexp_replace(trim(c."item_name"), '\s+', ' ', 'g')), jsonb_build_object('source', 'manual', 'backfilled', true)
FROM "cupboard_items" c WHERE c."is_depleted";
--> statement-breakpoint
INSERT INTO "kitchen_events" ("household_id", "actor_user_id", "occurred_at", "kind", "item_key", "payload")
SELECT p."household_id", p."user_id", p."updated_at", 'CORRECTED_GONE', lower(regexp_replace(trim(p."item_name"), '\s+', ' ', 'g')), jsonb_build_object('source', 'receipt', 'backfilled', true)
FROM "purchase_history" p WHERE p."is_depleted";
--> statement-breakpoint
INSERT INTO "kitchen_events" ("household_id", "actor_user_id", "occurred_at", "kind", "method", "payload")
SELECT r."household_id", r."user_id", COALESCE(r."purchase_date", r."created_at"), 'SHOP_DONE', 'RECEIPT', jsonb_build_object('receiptId', r."id", 'backfilled', true)
FROM "receipts" r WHERE r."status" = 'DONE';
-- END HAND-WRITTEN
