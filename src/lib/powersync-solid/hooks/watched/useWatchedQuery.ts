import { createEffect, onCleanup } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type {
  AbstractPowerSyncDatabase,
  CompilableQuery,
  ParsedQuery,
  WatchCompatibleQuery,
} from "@powersync/common";
import { parseQuery } from "@powersync/common";
import type {
  UseWatchedQueryHookOptions,
  WatchedQueryState,
} from "../../types.js";
import { isServerSide, resolveInitialLoading } from "../../internal/ssr.js";
import { usePowerSync } from "../../context.js";
import type { Accessor } from "solid-js";

const resolveDb = (
  dbOption: Accessor<AbstractPowerSyncDatabase | null> | undefined,
  contextDb: AbstractPowerSyncDatabase | null,
) => {
  if (dbOption) {
    return dbOption();
  }

  return contextDb ?? null;
};

const wrapError = (error: Error) => {
  const wrapped = new Error("PowerSync failed to fetch data: " + error.message);
  wrapped.cause = error;
  return wrapped;
};

export const useWatchedQuery = <T = unknown>(
  query: Accessor<string | CompilableQuery<T>>,
  params: Accessor<unknown[]> = () => [],
  options: Accessor<UseWatchedQueryHookOptions<T>> = () => ({}),
): WatchedQueryState<T> => {
  const contextDb = usePowerSync();
  const initialOptions = options();
  const [state, setState] = createStore<WatchedQueryState<T>>({
    data: [],
    isLoading: resolveInitialLoading(initialOptions.ssr),
    isFetching: resolveInitialLoading(initialOptions.ssr),
    error: undefined,
  });

  createEffect(() => {
    if (isServerSide()) {
      return;
    }

    const currentOptions = options();
    const currentDb = resolveDb(currentOptions.db, contextDb);
    const active = currentOptions.active ? currentOptions.active() : true;

    if (!active) {
      setState(
        reconcile({
          data: [],
          isLoading: true,
          isFetching: false,
          error: undefined,
        }),
      );
      return;
    }

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
    setState("isFetching", true);
    setState("error", undefined);

    let parsedQuery: ParsedQuery;
    const queryValue = query();
    const currentParams = params();

    try {
      parsedQuery = parseQuery(queryValue, currentParams);
    } catch (error) {
      setState(
        reconcile({
          data: [],
          isLoading: false,
          isFetching: false,
          error: wrapError(error as Error),
        }),
      );
      return;
    }

    const compatibleQuery: WatchCompatibleQuery<T[]> = {
      compile: () => ({
        sql: parsedQuery.sqlStatement,
        parameters: parsedQuery.parameters,
      }),
      execute: async ({ db }) => {
        if (typeof queryValue === "string") {
          return db.getAll<T>(parsedQuery.sqlStatement, parsedQuery.parameters);
        }
        return queryValue.execute();
      },
    };

    const watch = currentOptions.rowComparator
      ? currentDb.customQuery(compatibleQuery).differentialWatch({
          rowComparator: currentOptions.rowComparator,
          reportFetching: currentOptions.reportFetching,
          throttleMs: currentOptions.throttleMs,
        })
      : currentDb.customQuery(compatibleQuery).watch({
          reportFetching: currentOptions.reportFetching,
          throttleMs: currentOptions.throttleMs,
        });

    const disposer = watch.registerListener({
      onStateChange: (updatedState) => {
        if (updatedState.error) {
          setState(
            reconcile({
              data: [],
              isLoading: false,
              isFetching: false,
              error: wrapError(updatedState.error as Error),
            }),
          );
        } else {
          setState(
            reconcile({
              data: updatedState.data,
              isLoading: false,
              isFetching: false,
            }),
          );
        }
      },
    });

    onCleanup(() => {
      disposer();
      watch.close();
    });
  });

  return state;
};
