-- BEGIN HAND-WRITTEN
-- Backfill recipe_steps from recipes.instructions, the same way parseInstructions does it in
-- src/lib/services/recipes/steps.ts: one step per non-empty line, without a leading "Step 2:"
-- or "2." prefix. A first word in the cooking vocabulary (any case, trailing punctuation
-- ignored) becomes the verb and is taken off the text; otherwise the verb stays null.
-- Recipes that already have steps are skipped, so the block can run again.
WITH "lines" AS (
	SELECT r."id" AS "recipe_id", t."ord",
		btrim(regexp_replace(t."raw", '^\s*(step\s*\d+\s*[:.)-]?|\d+\s*[.):-])\s*', '', 'i')) AS "line"
	FROM "recipes" r
	CROSS JOIN LATERAL regexp_split_to_table(r."instructions", '\r?\n') WITH ORDINALITY AS t("raw", "ord")
	WHERE NOT EXISTS (SELECT 1 FROM "recipe_steps" s WHERE s."recipe_id" = r."id")
), "numbered" AS (
	SELECT "recipe_id", "line",
		(row_number() OVER (PARTITION BY "recipe_id" ORDER BY "ord") - 1)::int AS "position",
		lower(regexp_replace(split_part("line", ' ', 1), '[^A-Za-zÀ-ÿ]', '', 'g')) AS "first_word"
	FROM "lines" WHERE "line" <> ''
), "vocabulary"("word", "verb", "technique_key") AS (
	VALUES ('sweat', 'Sweat', 'sweat'), ('saute', 'Sauté', 'saute'), ('sauté', 'Sauté', 'saute'),
		('sear', 'Sear', 'sear'), ('bloom', 'Bloom', 'bloom'), ('simmer', 'Simmer', 'simmer'),
		('reduce', 'Reduce', 'reduce'), ('roast', 'Roast', 'roast'), ('fold', 'Fold', 'fold'),
		('rest', 'Rest', 'rest'), ('boil', 'Boil', 'boil')
)
INSERT INTO "recipe_steps" ("recipe_id", "position", "verb", "text", "technique_key")
SELECT n."recipe_id", n."position", v."verb",
	CASE
		WHEN v."verb" IS NULL THEN n."line"
		WHEN strpos(n."line", ' ') = 0 THEN ''
		ELSE btrim(substr(n."line", strpos(n."line", ' ') + 1))
	END,
	v."technique_key"
FROM "numbered" n
LEFT JOIN "vocabulary" v ON v."word" = n."first_word";
-- END HAND-WRITTEN
