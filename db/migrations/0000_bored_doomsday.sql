CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"agent_message_id" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "agent_runs_status_check" CHECK ("agent_runs"."status" in ('running', 'completed', 'error', 'stopped'))
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"model_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"system_instructions" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"member_type" text NOT NULL,
	"member_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_members_member_type_check" CHECK ("channel_members"."member_type" in ('user', 'agent'))
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"author_type" text NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"mentioned_agent" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_author_type_check" CHECK ("messages"."author_type" in ('user', 'agent'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_message_id_messages_id_fk" FOREIGN KEY ("agent_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_runs_channel" ON "agent_runs" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_status" ON "agent_runs" USING btree ("channel_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_name_unique" ON "agents" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_members_channel_id_member_type_member_id_unique" ON "channel_members" USING btree ("channel_id","member_type","member_id");--> statement-breakpoint
CREATE INDEX "idx_channel_members_member" ON "channel_members" USING btree ("member_type","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_name_unique" ON "channels" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_messages_channel_time" ON "messages" USING btree ("channel_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_messages_author" ON "messages" USING btree ("author_type","author_id");
