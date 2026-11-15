ALTER TABLE "recipes" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "tag_source" jsonb;--> statement-breakpoint
CREATE INDEX "recipes_tags_idx" ON "recipes" USING gin ("tags");