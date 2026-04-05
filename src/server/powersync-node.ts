import {
  PowerSyncDatabase,
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  createBaseLogger,
  LogLevel,
} from "@powersync/node";
import { mkdir } from "fs/promises";
import { join } from "path";
import { powerSyncSchema } from "~/db/schema/powersync";

class PowerChatServerConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const endpoint =
      process.env.POWERSYNC_SERVICE_URL ||
      process.env.VITE_POWERSYNC_SERVICE_URL;
    const token = process.env.POWERSYNC_SERVER_TOKEN;

    if (!endpoint || !token) {
      throw new Error(
        "POWERSYNC_SERVICE_URL (or VITE_POWERSYNC_SERVICE_URL) and POWERSYNC_SERVER_TOKEN must be set",
      );
    }

    console.log("[powersync-node] fetched credentials", {
      hasEndpoint: Boolean(endpoint),
      hasToken: Boolean(token),
    });

    return {
      endpoint,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  async uploadData(_database: AbstractPowerSyncDatabase): Promise<void> {
    // No-op: server subscription is read-only
  }
}

const logger = createBaseLogger();
logger.setLevel(LogLevel.INFO);

let db: PowerSyncDatabase | null = null;
let initPromise: Promise<PowerSyncDatabase> | null = null;

async function waitForSync(database: PowerSyncDatabase) {
  const maybeWaitForReady = (database as any).waitForReady;
  const maybeWaitForFirstSync = (database as any).waitForFirstSync;

  if (typeof maybeWaitForReady === "function") {
    await maybeWaitForReady.call(database);
    return;
  }

  if (typeof maybeWaitForFirstSync === "function") {
    await maybeWaitForFirstSync.call(database);
  }
}

export async function getPowerSyncNode(): Promise<PowerSyncDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const dbLocation = join(process.cwd(), ".powersync");
    const dbFilename = "powerchat-server.db";
    await mkdir(dbLocation, { recursive: true });
    console.log("[powersync-node] initializing", { dbLocation, dbFilename });

    const database = new PowerSyncDatabase({
      schema: powerSyncSchema,
      database: { dbFilename, dbLocation },
      logger,
    });

    console.log("[powersync-node] connecting");
    await database.connect(new PowerChatServerConnector());
    console.log("[powersync-node] awaiting first sync");
    await waitForSync(database);

    db = database;
    console.log("[powersync-node] connected");
    return database;
  })();

  return initPromise;
}
