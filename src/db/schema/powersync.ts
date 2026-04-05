import { column, Schema, Table } from "@powersync/node";

export const powerSyncSchema = new Schema({
  users: new Table({
    created_at: column.text,
  }),
  agents: new Table(
    {
      name: column.text,
      model_config: column.text,
      system_instructions: column.text,
      description: column.text,
      created_at: column.text,
    },
    {
      indexes: {
        agents_name_idx: ["name"],
      },
    },
  ),
  channels: new Table(
    {
      name: column.text,
      created_by: column.text,
      created_at: column.text,
    },
    {
      indexes: {
        channels_name_idx: ["name"],
        channels_created_by_idx: ["created_by"],
      },
    },
  ),
  channel_members: new Table(
    {
      channel_id: column.text,
      member_type: column.text,
      member_id: column.text,
      joined_at: column.text,
    },
    {
      indexes: {
        idx_channel_members_member: ["member_type", "member_id"],
        idx_channel_members_channel: ["channel_id"],
      },
    },
  ),
  messages: new Table(
    {
      channel_id: column.text,
      author_type: column.text,
      author_id: column.text,
      content: column.text,
      mentioned_agent: column.text,
      created_at: column.text,
    },
    {
      indexes: {
        idx_messages_channel_time: ["channel_id", "created_at", "id"],
        idx_messages_author: ["author_type", "author_id"],
      },
    },
  ),
  documents: new Table(
    {
      channel_id: column.text,
      title: column.text,
      description: column.text,
      content: column.text,
      created_at: column.text,
    },
    {
      indexes: {
        idx_documents_channel: ["channel_id"],
      },
    },
  ),
  agent_runs: new Table(
    {
      channel_id: column.text,
      agent_id: column.text,
      agent_message_id: column.text,
      status: column.text,
      trace: column.text,
      error: column.text,
      started_at: column.text,
      completed_at: column.text,
    },
    {
      indexes: {
        idx_agent_runs_channel: ["channel_id"],
        idx_agent_runs_status: ["channel_id", "status"],
      },
    },
  ),
});
