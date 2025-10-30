import { Accessor, createEffect, onCleanup } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { getPowerSync } from "~/lib/powersync";

type WatchState<T> = {
  data: T[];
  loading: boolean;
  error?: unknown;
};

export function useWatchedQuery<T = unknown>(
  sql: Accessor<string>,
  params: Accessor<unknown[]> = () => []
) {
  const [state, setState] = createStore<WatchState<T>>({
    data: [],
    loading: true,
  });

  createEffect(() => {
    const currentSql = sql();
    const currentParams = params();
    let cancelled = false;

    (async () => {
      try {
        const db = await getPowerSync();
        for await (const result of db.watch(currentSql, currentParams)) {
          if (cancelled) break;
          const rows = (result?.rows?._array ?? []) as T[];
          setState("data", reconcile(rows));
          setState("loading", false);
        }
      } catch (err) {
        if (!cancelled) {
          setState({ error: err, loading: false, data: state.data });
        }
      }
    })();

    onCleanup(() => {
      cancelled = true;
    });
  });

  return state;
}
