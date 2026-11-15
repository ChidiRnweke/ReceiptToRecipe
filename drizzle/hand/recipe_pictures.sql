-- BEGIN HAND-WRITTEN
-- Recipes that already have a picture get a source: a snapped recipe kept the snapped photo,
-- every other picture was generated. `source` is compared as text: on a new database the value
-- SNAPPED is added in the same transaction, and Postgres refuses a new enum value before commit.
UPDATE "recipes"
SET "image_source" = CASE WHEN "source"::text = 'SNAPPED' THEN 'SNAPPED'::"recipe_image_source" ELSE 'GENERATED'::"recipe_image_source" END
WHERE "image_url" IS NOT NULL AND "image_source" IS NULL;
-- END HAND-WRITTEN
