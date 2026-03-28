import { createMemo } from "solid-js";
import { getUsername } from "./getUsername";
import { useQuery } from "./powersync-solid";

export type SyncStreamQuery = {
  readonly sql: string;
  readonly autoSubscribe: boolean;
};

export function createIsoQuery(
  sql: () => string,
  options?: {
    autoSubscribe?: boolean;
  },
): SyncStreamQuery {
  return {
    get sql() {
      return sql();
    },
    autoSubscribe: options?.autoSubscribe ?? false,
  } as const;
}

export function useIsoQuery<T>(query: ReturnType<typeof createIsoQuery>) {
  const userId = createMemo(() => getUsername());
  return useQuery<T>(() => query.sql.replace(`auth.user_id()`, userId()!));
}
