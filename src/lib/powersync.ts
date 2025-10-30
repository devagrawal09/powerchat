import {
  PowerSyncDatabase,
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
} from "@powersync/web";
import { column, Schema, Table } from "@powersync/web";
import { Transaction } from "@powersync/common";
import {
  getPowerSyncToken,
  uploadData as uploadToServer,
} from "~/server/powersync";

// PowerSync connector using SolidStart server functions
class PowerChatConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    // Call server function directly - no HTTP overhead!
    const { token, expiresAt } = await getPowerSyncToken();
    return {
      endpoint: import.meta.env.VITE_POWERSYNC_SERVICE_URL,
      token,
      expiresAt: new Date(expiresAt),
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      // Call server function directly - no HTTP overhead!
      await uploadToServer(transaction.crud);

      // Mark as complete only after successful write
      await transaction.complete();
    } catch (error) {
      console.error("Upload failed:", error);
      throw error; // PowerSync will retry
    }
  }
}

// Define schema matching our Neon tables using new API
const schema = new Schema({
  users: new Table({
    id: column.text,
    display_name: column.text,
    created_at: column.text,
  }),
  agents: new Table({
    id: column.text,
    name: column.text,
    model_config: column.text,
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
    { indexes: { idx_channel_members_member: ["member_type", "member_id"] } }
  ),
  messages: new Table(
    {
      id: column.text,
      channel_id: column.text,
      author_type: column.text,
      author_id: column.text,
      content: column.text,
      created_at: column.text,
    },
    {
      indexes: {
        idx_messages_channel_time: ["channel_id", "created_at", "id"],
        idx_messages_author: ["author_type", "author_id"],
      },
    }
  ),
  message_mentions: new Table({
    id: column.text,
    message_id: column.text,
    agent_id: column.text,
  }),
});

let db: PowerSyncDatabase | null = null;

export async function getPowerSync(): Promise<PowerSyncDatabase> {
  if (!db) {
    db = new PowerSyncDatabase({
      schema,
      database: {
        dbFilename: "powerchat.db",
      },
    });

    // Connect to PowerSync Service
    const connector = new PowerChatConnector();
    await db.connect(connector);
  }
  return db;
}

// Helper to execute writes
export async function writeTransaction<T>(
  callback: (tx: Transaction) => Promise<T>
): Promise<T> {
  const powersync = await getPowerSync();
  return powersync.writeTransaction(callback);
}
