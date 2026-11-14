CREATE TYPE "public"."shopping_item_source" AS ENUM('PLAN', 'USUAL', 'MANUAL', 'AGENT');--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "for_planned_meal_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "merge_key" text;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "held_until" timestamp;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "source" "shopping_item_source" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_list_items_need_idx" ON "shopping_list_items" USING btree ("shopping_list_id","source","merge_key",coalesce("unit", ''),("held_until" is not null)) WHERE "shopping_list_items"."source" in ('PLAN', 'USUAL');--> statement-breakpoint
-- BEGIN HAND-WRITTEN
-- Backfill: every existing list item was added by a person, so it keeps the MANUAL source from
-- the column default. Its merge key is the kitchen's item key of its name: trimmed,
-- single-spaced, lower case, the same normalization as `normalizeItemKey`.
UPDATE "shopping_list_items" SET "merge_key" = lower(regexp_replace(trim("name"), '\s+', ' ', 'g')) WHERE "merge_key" IS NULL;
-- END HAND-WRITTEN
