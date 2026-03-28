import { DiffTriggerOperation } from "@powersync/common";
import { getPowerSyncNode } from "./powersync-node";
import { onMessage } from "./onMessage";

type MessageRow = {
  id: string;
  channel_id: string;
  author_id: string;
  content: string | null;
  mentioned_agent: string | null;
  created_at: string | null;
};

const globalState = globalThis as typeof globalThis & {
  __powerchatMessageSubscriptionStarted?: boolean;
};

export async function startMessageSubscription(): Promise<void> {
  if (globalState.__powerchatMessageSubscriptionStarted) return;
  globalState.__powerchatMessageSubscriptionStarted = true;

  try {
    const db = await getPowerSyncNode();
    const inFlight = new Set<string>();

    await db.triggers.trackTableDiff({
      source: "messages",
      when: {
        [DiffTriggerOperation.INSERT]: "TRUE",
      },
      onChange: async (context) => {
        try {
          const insertedRows = await context.withDiff<MessageRow>(/* sql */ `
            SELECT messages.*
            FROM DIFF
            JOIN messages ON DIFF.id = messages.id
            WHERE DIFF.operation = 'INSERT'
              AND messages.author_type = 'user'
            ORDER BY messages.created_at ASC, messages.id ASC
          `);

          for (const row of insertedRows) {
            if (!row?.id || inFlight.has(row.id)) continue;
            inFlight.add(row.id);
            try {
              await onMessage(row);
            } catch (error) {
              console.error("[subscription] failed to process message", error);
            } finally {
              inFlight.delete(row.id);
            }
          }
        } catch (error) {
          console.error("[subscription] failed to process diff", error);
        }
      },
    });
  } catch (error) {
    console.error("[subscription] diff subscription failed", error);
    globalState.__powerchatMessageSubscriptionStarted = false;
  }
}
