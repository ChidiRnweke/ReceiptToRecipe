CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"used_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "household_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"color" text,
	"plans" boolean DEFAULT true NOT NULL,
	"shops" boolean DEFAULT true NOT NULL,
	"cooks" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "household_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "cupboard_items" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "planned_meals" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "purchase_history" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
-- Backfill: every existing user gets a household of one. The backfilled household reuses the
-- user's id so each row's household_id can be set from its user_id.
INSERT INTO "households" ("id", "name") SELECT "id", "name" || '''s kitchen' FROM "users";
--> statement-breakpoint
INSERT INTO "household_members" ("household_id", "user_id", "display_name") SELECT "id", "id", COALESCE(NULLIF(split_part("name", ' ', 1), ''), "email") FROM "users";
--> statement-breakpoint
UPDATE "cupboard_items" SET "household_id" = "user_id";
--> statement-breakpoint
UPDATE "planned_meals" SET "household_id" = "user_id";
--> statement-breakpoint
UPDATE "purchase_history" SET "household_id" = "user_id";
--> statement-breakpoint
UPDATE "receipts" SET "household_id" = "user_id";
--> statement-breakpoint
UPDATE "recipes" SET "household_id" = "user_id";
--> statement-breakpoint
UPDATE "shopping_lists" SET "household_id" = "user_id";
--> statement-breakpoint
ALTER TABLE "cupboard_items" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "planned_meals" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_history" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "recipes" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shopping_lists" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cupboard_items" ADD CONSTRAINT "cupboard_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "planned_meals" ADD CONSTRAINT "planned_meals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchase_history" ADD CONSTRAINT "purchase_history_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "household_invites_household_id_idx" ON "household_invites" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "household_members_household_id_idx" ON "household_members" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "cupboard_items_household_id_idx" ON "cupboard_items" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "planned_meals_household_id_idx" ON "planned_meals" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "purchase_history_household_id_idx" ON "purchase_history" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "receipts_household_id_idx" ON "receipts" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "recipes_household_id_idx" ON "recipes" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "shopping_lists_household_id_idx" ON "shopping_lists" USING btree ("household_id");
