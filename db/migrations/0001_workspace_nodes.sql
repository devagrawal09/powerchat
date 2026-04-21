CREATE TABLE "workspace_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL,
	"path" text NOT NULL,
	"parent_path" text,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"size_bytes" integer,
	"modified_at" timestamp with time zone NOT NULL,
	CONSTRAINT "workspace_nodes_kind_check" CHECK ("workspace_nodes"."kind" in ('file', 'dir'))
);
--> statement-breakpoint
ALTER TABLE "workspace_nodes" ADD CONSTRAINT "workspace_nodes_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_nodes_channel_id_path_unique" ON "workspace_nodes" USING btree ("channel_id","path");--> statement-breakpoint
CREATE INDEX "idx_workspace_nodes_channel_parent" ON "workspace_nodes" USING btree ("channel_id","parent_path");
