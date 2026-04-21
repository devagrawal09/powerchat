import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
});

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  modelConfig: jsonb("model_config")
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`)
    .notNull(),
  systemInstructions: text("system_instructions").default("").notNull(),
  description: text("description").default("").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
}, (table) => [uniqueIndex("agents_name_unique").on(table.name)]);

export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
}, (table) => [uniqueIndex("channels_name_unique").on(table.name)]);

export const channelMembers = pgTable("channel_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" })
    .notNull(),
  memberType: text("member_type").notNull(),
  memberId: text("member_id").notNull(),
  joinedAt: timestamp("joined_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
}, (table) => [
  uniqueIndex("channel_members_channel_id_member_type_member_id_unique").on(
    table.channelId,
    table.memberType,
    table.memberId,
  ),
  index("idx_channel_members_member").on(table.memberType, table.memberId),
  check(
    "channel_members_member_type_check",
    sql`${table.memberType} in ('user', 'agent')`,
  ),
]);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" })
    .notNull(),
  authorType: text("author_type").notNull(),
  authorId: text("author_id").notNull(),
  content: text("content").notNull(),
  mentionedAgent: jsonb("mentioned_agent").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("idx_messages_channel_time").on(
    table.channelId,
    table.createdAt,
    table.id,
  ),
  index("idx_messages_author").on(table.authorType, table.authorId),
  check(
    "messages_author_type_check",
    sql`${table.authorType} in ('user', 'agent')`,
  ),
]);

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" })
    .notNull(),
  agentId: text("agent_id").notNull(),
  agentMessageId: uuid("agent_message_id").references(() => messages.id, {
    onDelete: "set null",
  }),
  status: text("status").default("running").notNull(),
  error: text("error"),
  startedAt: timestamp("started_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", {
    withTimezone: true,
    mode: "string",
  }),
}, (table) => [
  index("idx_agent_runs_channel").on(table.channelId),
  index("idx_agent_runs_status").on(table.channelId, table.status),
  check(
    "agent_runs_status_check",
    sql`${table.status} in ('running', 'completed', 'error', 'stopped')`,
  ),
]);

export const workspaceNodes = pgTable("workspace_nodes", {
  id: text("id").primaryKey(),
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" })
    .notNull(),
  path: text("path").notNull(),
  parentPath: text("parent_path"),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  sizeBytes: integer("size_bytes"),
  modifiedAt: timestamp("modified_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
}, (table) => [
  uniqueIndex("workspace_nodes_channel_id_path_unique").on(
    table.channelId,
    table.path,
  ),
  index("idx_workspace_nodes_channel_parent").on(
    table.channelId,
    table.parentPath,
  ),
  check("workspace_nodes_kind_check", sql`${table.kind} in ('file', 'dir')`),
]);

export const serverSchema = {
  users,
  agents,
  channels,
  channelMembers,
  messages,
  agentRuns,
  workspaceNodes,
};
