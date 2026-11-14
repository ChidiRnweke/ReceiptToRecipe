-- BEGIN HAND-WRITTEN
-- Backfill: every existing list item was added by a person, so it keeps the MANUAL source from
-- the column default. Its merge key is its name trimmed, single-spaced and lower case; the app
-- applies the rest of its item-key rules (punctuation, singular) when it reads the key, so
-- "eggs" stored here matches "egg" in the kitchen.
UPDATE "shopping_list_items" SET "merge_key" = lower(regexp_replace(trim("name"), '\s+', ' ', 'g')) WHERE "merge_key" IS NULL;--> statement-breakpoint
-- A receipt read before this migration already counted its shop, so reading it again must not.
UPDATE "receipts" SET "shop_recorded_at" = "updated_at" WHERE "status" = 'DONE' AND "shop_recorded_at" IS NULL;
-- END HAND-WRITTEN
