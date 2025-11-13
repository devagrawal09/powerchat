import { Accessor, createEffect, onCleanup } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { getPowerSync } from "~/lib/powersync";
import {
  DiffTriggerOperation,
  type TriggerDiffHandlerContext,
} from "@powersync/common";

type WatchState<T> = {
  data: T[];
  loading: boolean;
  error?: unknown;
};

type TriggerBasedDiffOptions<T = unknown> = {
  // Table name to track
  source: string;
  // Initial query to load all data (returns full result set)
  initialQuery: string;
  initialParams?: unknown[];
  // WHEN clauses for each operation (INSERT, UPDATE, DELETE)
  when: {
    INSERT?: string;
    UPDATE?: string;
    DELETE?: string;
  };
  // Optional: columns to track (defaults to all columns)
  columns?: string[];
  // Optional: get unique ID from row (defaults to 'id' field)
  getId?: (row: T) => string;
  // Optional: sort function to maintain order after updates
  // If not provided, maintains relative order and appends new items at end
  sortFn?: (a: T, b: T) => number;
};

/**
 * Hook that uses PowerSync trigger-based diffs for efficient change tracking.
 *
 * This is more performant than regular watch queries for large result sets
 * because it only processes changed rows instead of re-querying everything.
 *
 * @example
 * ```tsx
 * const messages = useTriggerBasedDiff<MessageRow>(() => ({
 *   source: 'messages',
 *   initialQuery: `
 *     SELECT * FROM messages
 *     WHERE channel_id = ?
 *     ORDER BY created_at ASC, id ASC
 *   `,
 *   initialParams: [channelId],
 *   when: {
 *     INSERT: sanitizeSQL`json_extract(NEW.data, '$.channel_id') = ${channelId}`,
 *     UPDATE: sanitizeSQL`json_extract(NEW.data, '$.channel_id') = ${channelId}`,
 *     DELETE: sanitizeSQL`json_extract(OLD.data, '$.channel_id') = ${channelId}`,
 *   },
 * }));
 * ```
 */
export function useTriggerBasedDiff<T = unknown>(
  options: Accessor<TriggerBasedDiffOptions<T>>
) {
  const [state, setState] = createStore<WatchState<T>>({
    data: [],
    loading: true,
  });

  createEffect(() => {
    const opts = options();
    const source = opts.source;
    const initialQuery = opts.initialQuery;
    const initialParams = opts.initialParams || [];
    const when = opts.when;
    const columns = opts.columns;
    const getId = opts.getId || ((row: any) => row.id);
    const sortFn = opts.sortFn;

    let cancelled = false;
    let stopTrigger: (() => Promise<void>) | null = null;

    (async () => {
      try {
        const db = await getPowerSync();

        // Load initial data
        const initialResult = await db.execute(initialQuery, initialParams);
        const initialRows = (initialResult?.rows?._array ?? []) as T[];
        if (!cancelled) {
          setState("data", reconcile(initialRows));
          setState("loading", false);
        }

        // Build when clauses in the format expected by PowerSync
        const whenClauses: Partial<Record<DiffTriggerOperation, string>> = {};
        if (when.INSERT) whenClauses[DiffTriggerOperation.INSERT] = when.INSERT;
        if (when.UPDATE) whenClauses[DiffTriggerOperation.UPDATE] = when.UPDATE;
        if (when.DELETE) whenClauses[DiffTriggerOperation.DELETE] = when.DELETE;

        // Set up trigger-based diff tracking
        stopTrigger = await db.triggers.trackTableDiff({
          source,
          columns,
          when: whenClauses,
          onChange: async (context: TriggerDiffHandlerContext) => {
            if (cancelled) return;

            try {
              // Get all diff operations
              const allDiffs = await context.withDiff<{
                id: string;
                operation: string;
              }>(/* sql */ `
                SELECT DIFF.id, DIFF.operation
                FROM DIFF
              `);

              // Get inserted/updated rows (they exist in source table)
              const insertedOrUpdatedRows = await context.withDiff<
                T & { __operation?: string }
              >(/* sql */ `
                  SELECT ${source}.*, DIFF.operation as __operation
                  FROM DIFF
                  JOIN ${source} ON DIFF.id = ${source}.id
                  WHERE DIFF.operation IN ('INSERT', 'UPDATE')
                `);

              // Get deleted row IDs (they don't exist in source table anymore)
              const deletedIds = new Set(
                allDiffs
                  .filter((d) => d.operation === "DELETE")
                  .map((d) => d.id)
              );

              if (cancelled) return;

              // Apply changes to state
              setState("data", (currentData) => {
                // Create a map for efficient lookups
                const dataMap = new Map<string, { row: T; index: number }>();
                currentData.forEach((row, index) => {
                  dataMap.set(getId(row), { row, index });
                });

                // Process INSERT and UPDATE operations
                insertedOrUpdatedRows.forEach((rowWithOp: any) => {
                  const { __operation, ...row } = rowWithOp;
                  const id = getId(row as T);
                  dataMap.set(id, {
                    row: row as T,
                    index: dataMap.has(id)
                      ? dataMap.get(id)!.index
                      : currentData.length,
                  });
                });

                // Process DELETE operations
                deletedIds.forEach((id) => {
                  dataMap.delete(id);
                });

                // Convert back to array
                let updatedArray = Array.from(dataMap.values())
                  .sort((a, b) => a.index - b.index)
                  .map((item) => item.row);

                // Apply custom sort function if provided (e.g., ORDER BY created_at ASC)
                if (sortFn) {
                  updatedArray = updatedArray.sort(sortFn);
                }

                return updatedArray;
              });
            } catch (err) {
              if (!cancelled) {
                console.error(
                  "[useTriggerBasedDiff] Error processing diff:",
                  err
                );
                setState({ error: err });
              }
            }
          },
          hooks: {
            // Use beforeCreate hook to ensure we have the latest initial data
            // This ensures any changes after this point will be captured by the trigger
            beforeCreate: async (lockContext) => {
              // Re-query initial data inside the write lock to ensure consistency
              const result = await lockContext.execute(
                initialQuery,
                initialParams
              );
              const rows = (result?.rows?._array ?? []) as T[];
              if (!cancelled) {
                setState("data", reconcile(rows));
                setState("loading", false);
              }
            },
          },
        });
      } catch (err) {
        if (!cancelled) {
          console.error("[useTriggerBasedDiff] Error setting up trigger:", err);
          setState({ error: err, loading: false, data: state.data });
        }
      }
    })();

    onCleanup(() => {
      cancelled = true;
      if (stopTrigger) {
        stopTrigger().catch((err) => {
          console.error(
            "[useTriggerBasedDiff] Error cleaning up trigger:",
            err
          );
        });
      }
    });
  });

  return state;
}
