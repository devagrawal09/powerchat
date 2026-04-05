import {
  PowerSyncDatabase,
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  createBaseLogger,
  LogLevel,
} from "@powersync/web";
import {
  DrizzleAppSchema,
  wrapPowerSyncWithDrizzle,
  type PowerSyncSQLiteDatabase,
} from "@powersync/drizzle-driver";
import {
  uploadData as uploadToServer,
} from "~/server/powersync";
import { getPowerSyncToken } from "~/server/powersync-token";
import { clientSchema } from "~/db/schema/client";

const isTestEnv =
  import.meta.env.MODE === "test" || process.env.VITEST === "true";

function createTestClientDb(): PowerSyncSQLiteDatabase<typeof clientSchema> {
  const lockContext = {
    execute: async () => undefined,
    getAll: async () => [],
    get: async () => null,
    getOptional: async () => null,
  };

  const testDb = {
    readLock: async (callback: (ctx: typeof lockContext) => unknown) =>
      callback(lockContext),
    writeLock: async (callback: (ctx: typeof lockContext) => unknown) =>
      callback(lockContext),
    watch: () => {},
  } as any;

  return wrapPowerSyncWithDrizzle(testDb, { schema: clientSchema });
}

// PowerSync connector using SolidStart server functions
class PowerChatConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    console.log("[fetchCredentials] start");
    const { token, expiresAt } = await getPowerSyncToken();
    const endpoint = import.meta.env.VITE_POWERSYNC_SERVICE_URL;
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

export const powerSyncSchema = new DrizzleAppSchema(clientSchema);

export const powersync = isTestEnv
  ? ({} as PowerSyncDatabase)
  : new PowerSyncDatabase({
      schema: powerSyncSchema,
      database: { dbFilename: "powerchat.db" },
    });
export const clientDb = isTestEnv
  ? createTestClientDb()
  : wrapPowerSyncWithDrizzle(powersync, {
      schema: clientSchema,
    });
const connector = new PowerChatConnector();

const logger = createBaseLogger();
logger.setLevel(LogLevel.DEBUG);

let isInitialized = false;

export async function connectPowerSync() {
  if (isInitialized) {
    return;
  }

  if (isTestEnv) {
    isInitialized = true;
    return;
  }

  await powersync.connect(connector);
  await powersync.waitForReady();
  isInitialized = true;

  console.log("[getPowerSync] db connected");
}
