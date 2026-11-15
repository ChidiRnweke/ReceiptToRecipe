ALTER TYPE "public"."recipe_source" ADD VALUE 'COOKBOOK';--> statement-breakpoint
CREATE TABLE "cookbook_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" integer NOT NULL,
	"revision_id" integer NOT NULL,
	"title" text NOT NULL,
	"page_title" text NOT NULL,
	"source_url" text NOT NULL,
	"licence" text DEFAULT 'CC BY-SA 4.0' NOT NULL,
	"recipe" jsonb NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"cuisine" text,
	"item_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"structured_by" text NOT NULL,
	"image_url" text,
	"image_status" "processing_status" DEFAULT 'QUEUED' NOT NULL,
	"image_source" "recipe_image_source",
	"image_credit" jsonb,
	"embedding" vector(768),
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cookbook_recipes_page_id_unique" UNIQUE("page_id")
);
--> statement-breakpoint
ALTER TABLE "cookbook_embeddings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "cookbook_embeddings" CASCADE;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "cookbook_recipe_id" uuid;--> statement-breakpoint
CREATE INDEX "cookbook_recipes_tags_idx" ON "cookbook_recipes" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "cookbook_recipes_item_keys_idx" ON "cookbook_recipes" USING gin ("item_keys");--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_cookbook_recipe_id_cookbook_recipes_id_fk" FOREIGN KEY ("cookbook_recipe_id") REFERENCES "public"."cookbook_recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_household_cookbook_idx" ON "recipes" USING btree ("household_id","cookbook_recipe_id");