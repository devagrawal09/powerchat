import { createEffect, onCleanup, type Accessor } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type {
  AbstractPowerSyncDatabase,
  TriggerDiffHandlerContext,
} from "@powersync/common";
import { DiffTriggerOperation } from "@powersync/common";
import type {
  TriggerBasedDiffState,
  UseTriggerBasedDiffOptions,
} from "../types.js";
import { isServerSide, resolveInitialLoading } from "../internal/ssr.js";
import { usePowerSync } from "../context.js";

const resolveDb = (
  dbOption: Accessor<AbstractPowerSyncDatabase | null> | undefined,
  contextDb: AbstractPowerSyncDatabase | null,
) => {
  if (dbOption) {
    return dbOption();
  }

  return contextDb ?? null;
};

export const useTriggerBasedDiff = <T = unknown>(
  options: Accessor<UseTriggerBasedDiffOptions<T>>,
): TriggerBasedDiffState<T> => {
  const contextDb = usePowerSync();
  const initialOptions = options();
  const [state, setState] = createStore<TriggerBasedDiffState<T>>({
    data: [],
    isLoading: resolveInitialLoading(initialOptions.ssr),
    error: undefined,
  });

  createEffect(() => {
    if (isServerSide()) {
      return;
    }

    const currentOptions = options();
    const currentDb = resolveDb(currentOptions.db, contextDb);

    if (!currentDb) {
      setState(
        reconcile({
          data: [],
          isLoading: false,
          isFetching: false,
          error: new Error("PowerSync not configured."),
        }),
      );
      return;
    }

    setState("isLoading", true);
    setState("error", undefined);

    const source = currentOptions.source;
    const initialQuery = currentOptions.initialQuery;
    const initialParams = currentOptions.initialParams ?? [];
    const when = currentOptions.when;
    const columns = currentOptions.columns;
    const getId = currentOptions.getId ?? ((row: any) => row.id);
    const sortFn = currentOptions.sortFn;

    let cancelled = false;
    let stopTrigger: (() => Promise<void>) | null = null;

    (async () => {
      try {
        const initialResult = await currentDb.execute(
          initialQuery,
          initialParams,
        );
        const initialRows = (initialResult?.rows?._array ?? []) as T[];
        if (!cancelled) {
          setState("data", reconcile(initialRows));
          setState("isLoading", false);
        }

        const whenClauses: Partial<Record<DiffTriggerOperation, string>> = {};
        if (when.INSERT) {
          whenClauses[DiffTriggerOperation.INSERT] = when.INSERT;
        }
        if (when.UPDATE) {
          whenClauses[DiffTriggerOperation.UPDATE] = when.UPDATE;
        }
        if (when.DELETE) {
          whenClauses[DiffTriggerOperation.DELETE] = when.DELETE;
        }

        stopTrigger = await currentDb.triggers.trackTableDiff({
          source,
          columns,
          when: whenClauses,
          onChange: async (context: TriggerDiffHandlerContext) => {
            if (cancelled) {
              return;
            }

            try {
              const allDiffs = await context.withDiff<{
                id: string;
                operation: string;
              }>(/* sql */ `
                  SELECT DIFF.id, DIFF.operation
                  FROM DIFF
                `);

              const insertedOrUpdatedRows = await context.withDiff<
                T & { __operation?: string }
              >(/* sql */ `
                  SELECT ${source}.*, DIFF.operation as __operation
                  FROM DIFF
                  JOIN ${source} ON DIFF.id = ${source}.id
                  WHERE DIFF.operation IN ('INSERT', 'UPDATE')
                `);

              const deletedIds = new Set(
                allDiffs
                  .filter((diff) => diff.operation === "DELETE")
                  .map((diff) => diff.id),
              );

              if (cancelled) {
                return;
              }

              setState("data", (currentData) => {
                const dataMap = new Map<string, { row: T; index: number }>();
                currentData.forEach((row, index) => {
                  dataMap.set(getId(row), { row, index });
                });

                insertedOrUpdatedRows.forEach((rowWithOp: any) => {
                  const { __operation, ...row } = rowWithOp;
                  const id = getId(row as T);
                  const existing = dataMap.get(id);
                  dataMap.set(id, {
                    row: row as T,
                    index: existing ? existing.index : currentData.length,
                  });
                });

                deletedIds.forEach((id) => {
                  dataMap.delete(id);
                });

                let updatedArray = Array.from(dataMap.values())
                  .sort((a, b) => a.index - b.index)
                  .map((item) => item.row);

                if (sortFn) {
                  updatedArray = updatedArray.sort(sortFn);
                }

                return updatedArray;
              });
            } catch (error) {
              if (!cancelled) {
                setState("error", error as Error);
              }
            }
          },
          hooks: {
            beforeCreate: async (lockContext) => {
              const result = await lockContext.execute(
                initialQuery,
                initialParams,
              );
              const rows = (result?.rows?._array ?? []) as T[];
              if (!cancelled) {
                setState("data", reconcile(rows));
                setState("isLoading", false);
              }
            },
          },
        });
      } catch (error) {
        if (!cancelled) {
          setState("error", error as Error);
          setState("isLoading", false);
        }
      }
    })();

    onCleanup(() => {
      cancelled = true;
      if (stopTrigger) {
        stopTrigger().catch(() => undefined);
      }
    });
  });

  return state;
};
