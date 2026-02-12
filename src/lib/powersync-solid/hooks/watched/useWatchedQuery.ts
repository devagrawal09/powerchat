import {
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  type Accessor,
} from "solid-js";
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
import { isServerSide } from "../../internal/ssr.js";
import { usePowerSync } from "../../context.js";

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

  // Track if this is the initial load vs a refetch
  const [watchError, setWatchError] = createSignal<Error | undefined>(
    undefined,
  );

  // Create a source signal that tracks all the reactive dependencies
  const source = () => {
    if (isServerSide()) {
      return null;
    }

    const currentOptions = options();
    const currentDb = resolveDb(currentOptions.db, contextDb);
    const active = currentOptions.active ? currentOptions.active() : true;

    if (!active) {
      return null;
    }

    if (!currentDb) {
      return null;
    }

    return {
      query: query(),
      params: params(),
      options: currentOptions,
      db: currentDb,
      active,
      error: watchError(),
    };
  };

  const [resource, { mutate }] = createResource(
    source,
    async (src) => {
      if (src.error) {
        throw src.error;
      }

      let parsedQuery: ParsedQuery;
      try {
        parsedQuery = parseQuery(src.query, src.params);
      } catch (error) {
        throw wrapError(error as Error);
      }

      // Execute the query
      let result: T[];
      if (typeof src.query === "string") {
        result = await src.db!.getAll<T>(
          parsedQuery.sqlStatement,
          parsedQuery.parameters,
        );
      } else {
        result = await src.query.execute();
      }

      return result as ReadonlyArray<Readonly<T>>;
    },
    {
      initialValue: [] as ReadonlyArray<Readonly<T>>,
    },
  );

  // Set up the watch subscription for live updates
  createEffect(() => {
    if (isServerSide()) {
      return;
    }

    const currentOptions = options();
    const currentDb = resolveDb(currentOptions.db, contextDb);
    const active = currentOptions.active ? currentOptions.active() : true;

    if (!active || !currentDb) {
      return;
    }

    let parsedQuery: ParsedQuery;
    const queryValue = query();
    const currentParams = params();

    try {
      parsedQuery = parseQuery(queryValue, currentParams);
    } catch {
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
        mutate(updatedState.data);
        setWatchError(updatedState.error ?? undefined);
      },
    });

    onCleanup(() => {
      disposer();
      watch.close();
    });
  });

  // Return a state object that mirrors the old API but is backed by the resource
  // The resource itself provides Suspense support - accessing data() in a Suspense boundary
  // will automatically suspend until data is available
  return {
    get data() {
      // This getter will cause Suspense to kick in when accessed
      return resource() ?? [];
    },
    get isLoading() {
      return resource.loading;
    },
    get error() {
      return resource.error;
    },
  };
};
