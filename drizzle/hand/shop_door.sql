-- BEGIN HAND-WRITTEN
-- Backfill: every existing list item was added by a person, so it keeps the MANUAL source from
-- the column default. Its merge key is the kitchen's item key of its name: trimmed,
-- single-spaced, lower case, the same normalization as `normalizeItemKey`.
UPDATE "shopping_list_items" SET "merge_key" = lower(regexp_replace(trim("name"), '\s+', ' ', 'g')) WHERE "merge_key" IS NULL;--> statement-breakpoint
-- A receipt read before this migration already counted its shop, so reading it again must not.
UPDATE "receipts" SET "shop_recorded_at" = "updated_at" WHERE "status" = 'DONE' AND "shop_recorded_at" IS NULL;
-- END HAND-WRITTEN
