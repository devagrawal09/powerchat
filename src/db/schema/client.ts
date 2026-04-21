import { sqliteTable, text, index, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().notNull(),
  createdAt: text("created_at").notNull(),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  modelConfig: text("model_config").notNull(),
  systemInstructions: text("system_instructions").notNull(),
  description: text("description").notNull(),
  createdAt: text("created_at").notNull(),
});

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
});

export const channelMembers = sqliteTable(
  "channel_members",
  {
    id: text("id").primaryKey().notNull(),
    channelId: text("channel_id").notNull(),
    memberType: text("member_type").notNull(),
    memberId: text("member_id").notNull(),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => [
    index("idx_channel_members_member").on(table.memberType, table.memberId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey().notNull(),
    channelId: text("channel_id").notNull(),
    authorType: text("author_type").notNull(),
    authorId: text("author_id").notNull(),
    content: text("content").notNull(),
    mentionedAgent: text("mentioned_agent"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_messages_channel_time").on(
      table.channelId,
      table.createdAt,
      table.id,
    ),
    index("idx_messages_author").on(table.authorType, table.authorId),
  ],
);

export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id").primaryKey().notNull(),
    channelId: text("channel_id").notNull(),
    agentId: text("agent_id").notNull(),
    agentMessageId: text("agent_message_id"),
    status: text("status").notNull(),
    error: text("error"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("idx_agent_runs_channel").on(table.channelId),
    index("idx_agent_runs_status").on(table.channelId, table.status),
  ],
);

export const workspaceNodes = sqliteTable(
  "workspace_nodes",
  {
    id: text("id").primaryKey().notNull(),
    channelId: text("channel_id").notNull(),
    path: text("path").notNull(),
    parentPath: text("parent_path"),
    name: text("name").notNull(),
    kind: text("kind").notNull().$type<"file" | "dir">(),
    sizeBytes: integer("size_bytes"),
    modifiedAt: text("modified_at").notNull(),
  },
  (table) => [
    index("idx_workspace_nodes_channel_parent").on(
      table.channelId,
      table.parentPath,
    ),
  ],
);

export const isoMutations = sqliteTable(
  "iso_mutations",
  {
    id: text("id").primaryKey().notNull(),
    mutationKey: text("mutation_key").notNull(),
    params: text("params").notNull(),
  },
  (table) => [index("idx_iso_mutations_sql").on(table.mutationKey)],
);

export const clientSchema = {
  users,
  agents,
  channels,
  channelMembers,
  messages,
  agentRuns,
  workspaceNodes,
  isoMutations: {
    tableDefinition: isoMutations,
    options: { localOnly: true },
  },
};
