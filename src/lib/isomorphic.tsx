import { createMemo, type JSX } from "solid-js";
import { getUsername } from "./getUsername";
import { useQuery } from "./powersync-solid";

export function createIsoQuery(sql: () => string) {
  return {
    get sql() {
      return sql();
    },
  } as const;
}

export function useIsoQuery<T>(query: ReturnType<typeof createIsoQuery>) {
  const userId = createMemo(() => getUsername());
  return useQuery<T>(() => query.sql.replace(`auth.user_id()`, userId()!));
}
