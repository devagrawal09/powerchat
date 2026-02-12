import { createEffect } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { WatchedQuery } from '@powersync/common';

export const useWatchedQuerySubscription = <
  ResultType = unknown,
  Query extends WatchedQuery<ResultType> = WatchedQuery<ResultType>
>(
  query: Query
): Query['state'] => {
  return useNullableWatchedQuerySubscription(query) as Query['state'];
};

export const useNullableWatchedQuerySubscription = <
  ResultType = unknown,
  Query extends WatchedQuery<ResultType> = WatchedQuery<ResultType>
>(
  query: Query | null
): Query['state'] | undefined => {
  const [state, setState] = createStore<Query['state']>(query?.state ?? ({} as Query['state']));

  createEffect(() => {
    if (!query) {
      return undefined;
    }

    setState(reconcile(query.state));

    return query.registerListener({
      onStateChange: (updatedState) => {
        setState(reconcile(updatedState));
      }
    });
  });

  return query ? state : undefined;
};
