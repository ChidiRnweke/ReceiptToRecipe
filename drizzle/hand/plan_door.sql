-- BEGIN HAND-WRITTEN
-- Meals already cooked with portions put aside keep that count as their extra portions.
UPDATE "planned_meals" AS pm
SET "extra_portions" = cooked."portions"
FROM (
	SELECT "planned_meal_id", max("portions") AS "portions"
	FROM "kitchen_events"
	WHERE "kind" = 'COOKED' AND "planned_meal_id" IS NOT NULL AND "portions" > 0
	GROUP BY "planned_meal_id"
) AS cooked
WHERE cooked."planned_meal_id" = pm."id" AND pm."extra_portions" = 0;
-- END HAND-WRITTEN
