CREATE TABLE "category_shelf_life" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"shelf_life_days" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_shelf_life_category_unique" UNIQUE("category")
);
--> statement-breakpoint
ALTER TABLE "purchase_history" ADD COLUMN "estimated_deplete_date" timestamp;