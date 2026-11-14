ALTER TYPE "public"."meal_type" ADD VALUE 'PREP';--> statement-breakpoint
ALTER TABLE "planned_meals" ADD COLUMN "extra_portions" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD COLUMN "leftover_of_id" uuid;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD COLUMN "is_prep" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD CONSTRAINT "planned_meals_leftover_of_id_planned_meals_id_fk" FOREIGN KEY ("leftover_of_id") REFERENCES "public"."planned_meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
