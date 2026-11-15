CREATE TABLE "agent_run_events" (
	"cursor" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"event" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"input" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"serialized_state" text,
	"failure" text,
	"cancel_requested_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_session_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"item" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_run_events" ADD CONSTRAINT "agent_run_events_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_conversation_id_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_session_items" ADD CONSTRAINT "agent_session_items_conversation_id_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_events_run_cursor_idx" ON "agent_run_events" USING btree ("run_id","cursor");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_user_request_idx" ON "agent_runs" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_one_active_idx" ON "agent_runs" USING btree ("conversation_id") WHERE "agent_runs"."status" in ('queued', 'running', 'cancelling');--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_session_items_conversation_position_idx" ON "agent_session_items" USING btree ("conversation_id","position");