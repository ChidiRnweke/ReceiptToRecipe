CREATE TYPE "public"."user_role" AS ENUM('WAITING', 'USER', 'ADMIN');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'WAITING' NOT NULL;