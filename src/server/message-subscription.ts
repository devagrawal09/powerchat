import { getPowerSyncNode } from "./powersync-node";
import { onMessage } from "./onMessage";

type MessageRow = {
  id: string;
  channel_id: string;
  author_id: string;
  content: string | null;
  created_at: string | null;
};

type PowerSyncResult = {
  rows?: { _array?: MessageRow[] } | MessageRow[];
};

const processedTable = "_processed_messages";

const globalState = globalThis as typeof globalThis & {
  __powerchatMessageSubscriptionStarted?: boolean;
};

function extractRows(result: PowerSyncResult): MessageRow[] {
  const rows = result?.rows;
  if (Array.isArray(rows)) return rows;
  if (rows && Array.isArray((rows as { _array?: MessageRow[] })._array)) {
    return (rows as { _array?: MessageRow[] })._array || [];
  }
  return [];
}

export async function startMessageSubscription(): Promise<void> {
  if (globalState.__powerchatMessageSubscriptionStarted) return;
  globalState.__powerchatMessageSubscriptionStarted = true;
  console.log("[subscription] boot");
  try {
    const db = await getPowerSyncNode();
    console.log("[subscription] database ready");
    await db.execute(
      `CREATE TABLE IF NOT EXISTS ${processedTable} (id TEXT PRIMARY KEY, processed_at TEXT)`
    );
    console.log("[subscription] processed table ready");

    const markProcessed = async (id: string) => {
      const processedAt = new Date().toISOString();
      await db.execute(
        `INSERT OR IGNORE INTO ${processedTable} (id, processed_at) VALUES (?, ?)`,
        [id, processedAt],
      );
    };

    const processedRows = (await db.getAll(
      `SELECT id FROM ${processedTable}`
    )) as { id: string }[];
    const processed = new Set(processedRows.map((row) => row.id));
    const inFlight = new Set<string>();
    console.log("[subscription] loaded processed ids", {
      count: processed.size,
    });

    if (processed.size === 0) {
      const existingRows = (await db.getAll(
        "SELECT id FROM messages WHERE author_type = 'user'"
      )) as { id: string }[];
      for (const row of existingRows) {
        if (!row?.id) continue;
        await markProcessed(row.id);
        processed.add(row.id);
      }
      console.log("[subscription] seeded existing messages", {
        count: existingRows.length,
      });
    }

    const handleRows = async (rows: MessageRow[]) => {
      for (const row of rows) {
        if (!row?.id || processed.has(row.id) || inFlight.has(row.id)) continue;
        inFlight.add(row.id);
        console.log("[subscription] message detected", {
          id: row.id,
          channelId: row.channel_id,
        });

        try {
          console.log("[subscription] processing", { id: row.id });
          await onMessage(row);
          await markProcessed(row.id);
          processed.add(row.id);
          console.log("[subscription] processed", { id: row.id });
        } catch (error) {
          console.error("[subscription] failed to process message", error);
        } finally {
          inFlight.delete(row.id);
        }
      }
    };

    const query =
      "SELECT id, channel_id, author_id, content, created_at FROM messages WHERE author_type = 'user' ORDER BY created_at ASC, id ASC";

    console.log("[subscription] starting messages watch");

    for await (const result of db.watch(query)) {
      const rows = extractRows(result as PowerSyncResult);
      console.log("[subscription] watch update", { rows: rows.length });
      await handleRows(rows);
    }
  } catch (error) {
    console.error("[subscription] watch failed", error);
    globalState.__powerchatMessageSubscriptionStarted = false;
  }
}
