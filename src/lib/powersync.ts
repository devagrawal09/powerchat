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
} from "@powersync/drizzle-driver";
import { uploadData as uploadToServer } from "~/server/powersync";
import { getPowerSyncToken } from "~/server/powersync-token";
import { clientSchema } from "~/db/schema/client";
import { getUsername } from "./getUsername";

// PowerSync connector using SolidStart server functions
class PowerChatConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    console.log("[fetchCredentials] start");

    if (!getUsername()) {
      throw new Error("No session");
    }

    const { token, expiresAt } = await getPowerSyncToken();
    const endpoint = import.meta.env.VITE_POWERSYNC_SERVICE_URL;

    if (!endpoint) {
      throw new Error("VITE_POWERSYNC_SERVICE_URL not set");
    }

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

export const powersync = new PowerSyncDatabase({
  schema: powerSyncSchema,
  database: { dbFilename: "powerchat.db" },
});

export const clientDb = wrapPowerSyncWithDrizzle(powersync, {
  schema: clientSchema,
});
const connector = new PowerChatConnector();

const logger = createBaseLogger();
logger.setLevel(LogLevel.DEBUG);

let isInitialized = false;
let connectPromise: Promise<void> | null = null;

export async function connectPowerSync() {
  if (isInitialized) {
    return;
  }

  if (!getUsername()) {
    return;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    await powersync.connect(connector);
    await powersync.waitForReady();
    isInitialized = true;
  })();

  try {
    await connectPromise;
  } finally {
    connectPromise = null;
  }

  console.log("[getPowerSync] db connected");
}
