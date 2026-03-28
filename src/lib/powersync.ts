import {
  PowerSyncDatabase,
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  createBaseLogger,
  LogLevel,
} from "@powersync/web";
import { column, Schema, Table } from "@powersync/web";
import {
  getPowerSyncToken,
  uploadData as uploadToServer,
} from "~/server/powersync";

// PowerSync connector using SolidStart server functions
class PowerChatConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    console.log("[fetchCredentials] start");
    // Call server function directly - no HTTP overhead!
    const { token, expiresAt } = await getPowerSyncToken();
    const endpoint = import.meta.env.VITE_POWERSYNC_SERVICE_URL;
    console.log({ endpoint, token, expiresAt });
    return { endpoint, token, expiresAt: new Date(expiresAt) };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    console.log("[uploadData] uploadData start");
    // Process all pending transactions in a loop
    while (true) {
      const transaction = await database.getNextCrudTransaction();
      if (!transaction) {
        break;
      }

      console.log("[uploadData] transaction", transaction);

      // Call server function directly - no HTTP overhead!
      const p = uploadToServer(
        transaction.crud.map((op) => ({
          op: op.op,
          table: op.table,
          id: op.id,
          opData: op.opData ?? {},
        })),
      );

      console.log("[uploadData] p", p);

      const result = await p;

      console.log("[uploadData] result", result);

      // Check if upload was successful
      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

      // Mark as complete only after successful write
      await transaction.complete();
    }
    console.log("[uploadData] uploadData end");
  }
}

const schema = new Schema({
  users: new Table({
    id: column.text,
    created_at: column.text,
  }),
  agents: new Table({
    id: column.text,
    name: column.text,
    model_config: column.text,
    system_instructions: column.text,
    description: column.text,
    created_at: column.text,
  }),
  channels: new Table({
    id: column.text,
    name: column.text,
    created_by: column.text,
    created_at: column.text,
  }),
  channel_members: new Table(
    {
      id: column.text,
      channel_id: column.text,
      member_type: column.text,
      member_id: column.text,
      joined_at: column.text,
    },
    { indexes: { idx_channel_members_member: ["member_type", "member_id"] } },
  ),
  messages: new Table(
    {
      id: column.text,
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
      id: column.text,
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
      id: column.text,
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

export const powersync = new PowerSyncDatabase({
  schema,
  database: { dbFilename: "powerchat.db" },
});
const connector = new PowerChatConnector();

const logger = createBaseLogger();
logger.setLevel(LogLevel.DEBUG);

let isInitialized = false;

export async function connectPowerSync() {
  if (isInitialized) {
    return;
  }

  await powersync.connect(connector);
  await powersync.waitForReady();
  isInitialized = true;

  console.log("[getPowerSync] db connected");
}
