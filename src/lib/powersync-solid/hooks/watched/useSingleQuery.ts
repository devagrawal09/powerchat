import { createResource, createSignal, type Accessor } from "solid-js";
import type {
  AbstractPowerSyncDatabase,
  CompilableQuery,
} from "@powersync/common";
import { parseQuery } from "@powersync/common";
import type { QueryResult, UseSingleQueryOptions } from "../../types.js";
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

export const useSingleQuery = <T = unknown>(
  query: Accessor<string | CompilableQuery<T>>,
  params: Accessor<unknown[]> = () => [],
  options: Accessor<UseSingleQueryOptions> = () => ({}),
): QueryResult<T> => {
  const contextDb = usePowerSync();

  // Create a source signal that tracks all the reactive dependencies
  const source = ():
    | {
        query: string | CompilableQuery<T>;
        params: unknown[];
        db: AbstractPowerSyncDatabase | null;
        active: boolean;
      }
    | false => {
    if (isServerSide()) {
      return false;
    }

    const currentOptions = options();
    const currentDb = resolveDb(currentOptions.db, contextDb);
    const active = currentOptions.active ? currentOptions.active() : true;

    if (!active) {
      return false;
    }

    if (!currentDb) {
      return false;
    }

    return {
      query: query(),
      params: params(),
      db: currentDb,
      active,
    };
  };

  const [resource, { refetch }] = createResource(
    source,
    async (src) => {
      // let parsedQuery: ParsedQuery;
      try {
        const parsedQuery = parseQuery(src.query, src.params);

        let result: T[];
        if (typeof src.query === "string") {
          result = await src.db!.getAll<T>(
            parsedQuery.sqlStatement,
            parsedQuery.parameters,
          );
        } else {
          result = await src.query.execute();
        }

        return result;
      } catch (error) {
        throw wrapError(error as Error);
      }
    },
    { initialValue: [] as T[] },
  );

  // Return a state object that mirrors the old API but is backed by the resource
  // The resource itself provides Suspense support
  return {
    get data() {
      return resource() ?? [];
    },
    get isLoading() {
      return resource.loading;
    },
    get error() {
      return resource.error;
    },
    refresh: async (signal?: AbortSignal) => {
      if (signal?.aborted) return;
      await refetch();
    },
  };
};
