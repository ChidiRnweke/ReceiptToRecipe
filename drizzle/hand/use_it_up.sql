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
