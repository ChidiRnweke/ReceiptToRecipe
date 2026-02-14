CREATE TABLE "waitlist_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";