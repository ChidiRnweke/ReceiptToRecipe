-- BEGIN HAND-WRITTEN
-- Backfill: every existing list item was added by a person, so it keeps the MANUAL source from
-- the column default. Its merge key is the kitchen's item key of its name: trimmed,
-- single-spaced, lower case, the same normalization as `normalizeItemKey`.
UPDATE "shopping_list_items" SET "merge_key" = lower(regexp_replace(trim("name"), '\s+', ' ', 'g')) WHERE "merge_key" IS NULL;
-- END HAND-WRITTEN
