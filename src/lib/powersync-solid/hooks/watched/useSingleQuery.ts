import { createEffect, onCleanup } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import type { AbstractPowerSyncDatabase, CompilableQuery, ParsedQuery } from '@powersync/common';
import { parseQuery } from '@powersync/common';
import type { QueryResult, UseSingleQueryOptions } from '../../types.js';
import { isServerSide, resolveInitialLoading } from '../../internal/ssr.js';
import { usePowerSync } from '../../context.js';
import type { Accessor } from 'solid-js';

const resolveDb = (
  dbOption: Accessor<AbstractPowerSyncDatabase | null> | undefined,
  contextDb: AbstractPowerSyncDatabase | null
) => {
  if (dbOption) {
    return dbOption();
  }

  return contextDb ?? null;
};

const wrapError = (error: Error) => {
  const wrapped = new Error('PowerSync failed to fetch data: ' + error.message);
  wrapped.cause = error;
  return wrapped;
};

export const useSingleQuery = <T = unknown>(
  query: Accessor<string | CompilableQuery<T>>,
  params: Accessor<unknown[]> = () => [],
  options: Accessor<UseSingleQueryOptions> = () => ({})
): QueryResult<T> => {
  const contextDb = usePowerSync();
  const initialOptions = options();
  const [state, setState] = createStore<QueryResult<T>>({
    data: [],
    isLoading: resolveInitialLoading(initialOptions.ssr),
    isFetching: resolveInitialLoading(initialOptions.ssr),
    error: undefined
  });

  let refreshImpl: (signal?: AbortSignal) => Promise<void> = async () => undefined;

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
          error: undefined
        })
      );
      return;
    }

    if (!currentDb) {
      setState(
        reconcile({
          data: [],
          isLoading: false,
          isFetching: false,
          error: new Error('PowerSync not configured.')
        })
      );
      return;
    }

    const currentQuery = query();
    const currentParams = params();

    let parsedQuery: ParsedQuery;
    try {
      parsedQuery = parseQuery(currentQuery, currentParams);
    } catch (error) {
      setState(
        reconcile({
          data: [],
          isLoading: false,
          isFetching: false,
          error: wrapError(error as Error)
        })
      );
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    refreshImpl = async (signal?: AbortSignal) => {
      setState('isLoading', true);
      setState('isFetching', true);
      setState('error', undefined);

      try {
        const result =
          typeof currentQuery === 'string'
            ? await currentDb.getAll<T>(parsedQuery.sqlStatement, parsedQuery.parameters)
            : await currentQuery.execute();

        if (cancelled || signal?.aborted || abortController.signal.aborted) {
          return;
        }

        setState(
          reconcile({
            data: result,
            isLoading: false,
            isFetching: false,
            error: undefined
          })
        );
      } catch (error) {
        if (cancelled || signal?.aborted || abortController.signal.aborted) {
          return;
        }

        setState(
          reconcile({
            data: [],
            isLoading: false,
            isFetching: false,
            error: wrapError(error as Error)
          })
        );
      }
    };

    refreshImpl(abortController.signal);

    onCleanup(() => {
      cancelled = true;
      abortController.abort();
    });
  });

  return Object.assign(state, {
    refresh: (signal?: AbortSignal) => refreshImpl(signal)
  });
};
