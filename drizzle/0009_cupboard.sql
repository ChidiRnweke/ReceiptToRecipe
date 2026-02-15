-- Cupboard Items table (manually added items, not from receipts)
CREATE TABLE "cupboard_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"quantity" numeric(10, 3),
	"unit" text,
	"category" text,
	"added_date" timestamp DEFAULT now() NOT NULL,
	"shelf_life_days" integer,
	"is_depleted" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cupboard_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint
-- User override columns on purchase_history for cupboard overrides
ALTER TABLE "purchase_history" ADD COLUMN "user_override_date" timestamp;
--> statement-breakpoint
ALTER TABLE "purchase_history" ADD COLUMN "user_shelf_life_days" integer;
--> statement-breakpoint
ALTER TABLE "purchase_history" ADD COLUMN "user_quantity_override" numeric(10, 3);
--> statement-breakpoint
ALTER TABLE "purchase_history" ADD COLUMN "is_depleted" boolean DEFAULT false NOT NULL;
