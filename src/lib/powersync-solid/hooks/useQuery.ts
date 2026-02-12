import type { CompilableQuery } from '@powersync/common';
import type {
  DifferentialHookOptions,
  QueryResult,
  ReadonlyQueryResult,
  UseQueryOptions
} from '../types.js';
import { useWatchedQuery } from './watched/useWatchedQuery.js';
import { useSingleQuery } from './watched/useSingleQuery.js';
import { useAllSyncStreamsHaveSynced } from './streams.js';
import { usePowerSync } from '../context.js';
import { Accessor, createMemo } from 'solid-js';

export function useQuery<RowType = unknown>(
  query: Accessor<string | CompilableQuery<RowType>>,
  parameters?: Accessor<unknown[]>,
  options?: Accessor<UseQueryOptions<RowType>>
): Accessor<QueryResult<RowType>>;
export function useQuery<RowType = unknown>(
  query: Accessor<string | CompilableQuery<RowType>>,
  parameters?: Accessor<unknown[]>,
  options?: Accessor<DifferentialHookOptions<RowType> & UseQueryOptions<RowType>>
): Accessor<ReadonlyQueryResult<RowType>>;
export function useQuery<RowType = unknown>(
  query: Accessor<string | CompilableQuery<RowType>>,
  parameters: Accessor<unknown[]> = () => [],
  options: Accessor<UseQueryOptions<RowType>> = () => ({})
) {
  const contextDb = usePowerSync();

  const streamsHaveSynced = useAllSyncStreamsHaveSynced(
    () => {
      const resolved = options();
      return resolved.db ? resolved.db() : (contextDb ?? null);
    },
    () => options().streams
  );

  const runQueryOnce = createMemo(() => options().runQueryOnce === true);

  return createMemo(() => {
    if (runQueryOnce()) {
      return useSingleQuery<RowType>(query, parameters, () => {
        const resolved = options();
        return {
          db: resolved.db,
          ssr: resolved.ssr,
          active: () => runQueryOnce() && streamsHaveSynced()
        };
      });
    }

    return useWatchedQuery<RowType>(query, parameters, () => {
      const resolved = options();
      return {
        db: resolved.db,
        ssr: resolved.ssr,
        rowComparator: resolved.rowComparator,
        reportFetching: resolved.reportFetching,
        throttleMs: resolved.throttleMs,
        active: () => !runQueryOnce() && streamsHaveSynced()
      };
    });
  });
}
