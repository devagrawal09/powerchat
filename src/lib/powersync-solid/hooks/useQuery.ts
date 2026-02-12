import type { CompilableQuery } from "@powersync/common";
import type {
  DifferentialHookOptions,
  QueryResult,
  ReadonlyQueryResult,
  UseQueryOptions,
} from "../types.js";
import { useWatchedQuery } from "./watched/useWatchedQuery.js";
import { useSingleQuery } from "./watched/useSingleQuery.js";
import { useAllSyncStreamsHaveSynced } from "./streams.js";
import { usePowerSync } from "../context.js";
import { Accessor } from "solid-js";

/**
 * A query hook that supports Suspense natively through createResource.
 *
 * When used inside a <Suspense> boundary, accessing the `data` property will
 * automatically suspend while the initial query is loading.
 *
 * @example
 * ```tsx
 * function Messages(props: { channelId: string }) {
 *   const result = useQuery<Message>(
 *     () => 'SELECT * FROM messages WHERE channel_id = ?',
 *     () => [props.channelId]
 *   );
 *
 *   return (
 *     <Suspense fallback={<div>Loading...</div>}>
 *       <For each={result().data}>
 *         {(msg) => <div>{msg.content}</div>}
 *       </For>
 *     </Suspense>
 *   );
 * }
 * ```
 */
export function useQuery<RowType = unknown>(
  query: Accessor<string | CompilableQuery<RowType>>,
  parameters?: Accessor<unknown[]>,
  options?: Accessor<UseQueryOptions<RowType>>,
): Accessor<QueryResult<RowType>>;
export function useQuery<RowType = unknown>(
  query: Accessor<string | CompilableQuery<RowType>>,
  parameters?: Accessor<unknown[]>,
  options?: Accessor<
    DifferentialHookOptions<RowType> & UseQueryOptions<RowType>
  >,
): Accessor<ReadonlyQueryResult<RowType>>;
export function useQuery<RowType = unknown>(
  query: Accessor<string | CompilableQuery<RowType>>,
  parameters: Accessor<unknown[]> = () => [],
  options: Accessor<UseQueryOptions<RowType>> = () => ({}),
): Accessor<QueryResult<RowType>> | Accessor<ReadonlyQueryResult<RowType>> {
  const contextDb = usePowerSync();
  const initialOptions = options();

  const streamsHaveSynced = useAllSyncStreamsHaveSynced(
    () => {
      const resolved = options();
      return resolved.db ? resolved.db() : (contextDb ?? null);
    },
    () => options().streams,
  );

  // Determine which hook to use based on initial options
  // This cannot be reactive since we can't conditionally call hooks
  if (initialOptions.runQueryOnce === true) {
    const state = useSingleQuery<RowType>(query, parameters, () => {
      const resolved = options();
      return {
        db: resolved.db,
        ssr: resolved.ssr,
        active: streamsHaveSynced,
      };
    });
    // Return an accessor that returns the state object
    // The state object has reactive getters that will trigger Suspense when accessed
    return () => state;
  }

  const state = useWatchedQuery<RowType>(query, parameters, () => {
    const resolved = options();
    return {
      db: resolved.db,
      ssr: resolved.ssr,
      rowComparator: resolved.rowComparator,
      reportFetching: resolved.reportFetching,
      throttleMs: resolved.throttleMs,
      active: streamsHaveSynced,
    };
  });

  // Return an accessor that returns the state object
  // The state object has reactive getters that will trigger Suspense when accessed
  return () => state;
}
