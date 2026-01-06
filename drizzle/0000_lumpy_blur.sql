CREATE TYPE "public"."processing_status" AS ENUM('QUEUED', 'PROCESSING', 'DONE', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."recipe_source" AS ENUM('GENERATED', 'RAG', 'USER');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('WEIGHT', 'VOLUME', 'COUNT');--> statement-breakpoint
CREATE TABLE "cookbook_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_title" text NOT NULL,
	"content_chunk" text NOT NULL,
	"embedding" vector(768),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"last_purchased" timestamp NOT NULL,
	"purchase_count" integer DEFAULT 1 NOT NULL,
	"avg_quantity" numeric(10, 3),
	"avg_frequency_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"raw_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit" text NOT NULL,
	"unit_type" "unit_type" NOT NULL,
	"price" numeric(10, 2),
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"status" "processing_status" DEFAULT 'QUEUED' NOT NULL,
	"raw_ocr_data" jsonb,
	"store_name" text,
	"purchase_date" timestamp,
	"total_amount" numeric(10, 2),
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit" text NOT NULL,
	"unit_type" "unit_type" NOT NULL,
	"optional" boolean DEFAULT false,
	"notes" text,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"servings" integer DEFAULT 2 NOT NULL,
	"prep_time" integer,
	"cook_time" integer,
	"image_url" text,
	"image_status" "processing_status" DEFAULT 'QUEUED',
	"source" "recipe_source" DEFAULT 'GENERATED' NOT NULL,
	"cuisine_type" text,
	"estimated_calories" integer,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopping_list_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(10, 3),
	"unit" text,
	"checked" boolean DEFAULT false,
	"from_recipe_id" uuid,
	"notes" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"allergies" text[] DEFAULT '{}',
	"dietary_restrictions" text[] DEFAULT '{}',
	"cuisine_preferences" text[] DEFAULT '{}',
	"excluded_ingredients" text[] DEFAULT '{}',
	"caloric_goal" integer,
	"default_servings" integer DEFAULT 2,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"password_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "purchase_history" ADD CONSTRAINT "purchase_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_recipes" ADD CONSTRAINT "saved_recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_recipes" ADD CONSTRAINT "saved_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_from_recipe_id_recipes_id_fk" FOREIGN KEY ("from_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;