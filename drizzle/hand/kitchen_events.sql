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
