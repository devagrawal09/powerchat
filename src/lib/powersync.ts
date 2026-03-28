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
    // const { token, expiresAt } = await getPowerSyncToken();
    const endpoint = import.meta.env.VITE_POWERSYNC_SERVICE_URL;
    const token = `eyJhbGciOiJSUzI1NiIsImtpZCI6InBvd2Vyc3luYy1kZXYtMzIyM2Q0ZTMifQ.eyJzdWIiOiIxMjMiLCJpYXQiOjE3NzQ2ODQzMTAsImlzcyI6Imh0dHBzOi8vcG93ZXJzeW5jLWFwaS5qb3VybmV5YXBwcy5jb20iLCJhdWQiOiJodHRwczovLzY5YzcyZDM0YjViOTAyZDQ2OWIzNjRjMC5wb3dlcnN5bmMuam91cm5leWFwcHMuY29tIiwiZXhwIjoxNzc0NzI3NTEwfQ.E_1VH-NX1TxK_9dfaNe2hJ4AYCbW3M7tNPKEhx70ky2Axea91b20Lpefhcz5qeAlc5I3a8697KUREobaWXZCAbzsSgx4BQPH0vEGkJ3QyqAC7VYuOheIRFpVxh-RtcnvXeS2fF0UleZhH7gflxq99gaGSxenNcaje2ocZDIIIBiKLyMBDfgx-FD66ra4tvTmoznXN3Qu4onwEYLnDCFrrrU_FRBs8ujQts0p_HTbalFkF8P78hQP1A6Brk7FwHNs82xi41M-Ph1Tf_2p4dDazHoWAEIGroC6HNvN2WQ78GNWV1WwBkkjjriyY8c3oq7I5FZK-5cdflYXh8XbRzLcHg`;
    console.log({ endpoint, token });
    return {
      endpoint,
      token,
    };
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
