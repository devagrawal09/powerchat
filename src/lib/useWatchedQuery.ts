import {
  Accessor,
  createResource,
  createSignal,
  onCleanup,
  Setter,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { getPowerSync } from "~/lib/powersync";

export function useWatchedQuery<T = unknown>(
  sql: Accessor<string>,
  params: Accessor<unknown[]> = () => []
) {
  const data = createStream<T[]>(async function* () {
    const currentSql = sql();
    const currentParams = params();
    const db = await getPowerSync();
    const watchIterator = db.watch(currentSql, currentParams);
    for await (const result of watchIterator) {
      yield result.rows?._array as T[];
    }
  });

  return {
    get data() {
      return data() || [];
    },
    get loading() {
      return data.loading;
    },
  };
}

export function createStream<T = unknown>(source: Accessor<AsyncIterable<T>>) {
  let aborted = false;
  const [error, setError] = createSignal<Error | null>(null);

  const [data, { mutate }] = createResource(
    () => ({ source: source(), error: error() }),
    async ({ source, error }) => {
      if (error) {
        throw error;
      }
      if (aborted) {
        return;
      }

      // Get first result to satisfy Suspense
      const firstResult = await source[Symbol.asyncIterator]().next();
      if (firstResult.done) {
        return [];
      }

      const initialRows = firstResult.value;

      // Continue watching and update resource data
      (async () => {
        try {
          for await (const result of source) {
            if (aborted) break;
            mutate(result as any);
          }
        } catch (err) {
          if (!aborted) {
            setError(err as Error);
          }
        }
      })();

      return initialRows;
    },
    {
      storage: createDeepSignal,
    }
  );

  onCleanup(() => {
    aborted = true;
  });

  return data;
}

function createDeepSignal<T>(value: T) {
  const [store, setStore] = createStore({
    value: structuredClone(value),
  });
  return [
    () => store.value,
    (v: T) => {
      typeof v === "function" && (v = v());
      setStore("value", reconcile(structuredClone(v)));
      return store.value;
    },
  ] as [Accessor<T>, Setter<T>];
}
