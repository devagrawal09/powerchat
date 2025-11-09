import {
  PowerSyncDatabase,
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  createBaseLogger,
  LogLevel,
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
    const endpoint = import.meta.env.VITE_POWERSYNC_SERVICE_URL;
    return { endpoint, token, expiresAt: new Date(expiresAt) };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    console.log("[uploadData] uploadData");
    // Process all pending transactions in a loop
    while (true) {
      const transaction = await database.getNextCrudTransaction();
      if (!transaction) {
        break;
      }

      try {
        // Call server function directly - no HTTP overhead!
        const result = await uploadToServer(
          transaction.crud.map((op) => ({
            op: op.op,
            table: op.table,
            id: op.id,
            opData: op.opData ?? {},
          }))
        );

        // Check if upload was successful
        if (!result.success) {
          throw new Error(result.error || "Upload failed");
        }

        // Mark as complete only after successful write
        await transaction.complete();
      } catch (error) {
        console.error("[PowerSync] Upload failed:", error);
        throw error; // PowerSync will retry
      }
    }
  }
}

// Define schema matching our Neon tables using new API
const schema = new Schema({
  users: new Table({
    id: column.text,
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
});

let db: PowerSyncDatabase | null = null;

const logger = createBaseLogger();
logger.setLevel(LogLevel.DEBUG);

export async function getPowerSync() {
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
    await db.waitForReady();
    console.log("[getPowerSync] db connected");
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
