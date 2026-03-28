import { createMemo, createEffect } from "solid-js";
import { getUsername } from "./getUsername";
import { usePowerSync, useQuery } from "./powersync-solid";
import { getSyncStreamNameForSql } from "./sync-streams";

export type IsoQuery = {
  readonly sql: string;
  readonly autoSubscribe: boolean;
};

export type IsoMutation = {
  readonly sql: string;
};

export function createIsoQuery(
  sql: () => string,
  options?: {
    autoSubscribe?: boolean;
  },
): IsoQuery {
  return {
    get sql() {
      return sql();
    },
    autoSubscribe: options?.autoSubscribe ?? false,
  } as const;
}

export function useIsoQuery<T>(query: ReturnType<typeof createIsoQuery>) {
  const userId = createMemo(() => getUsername());
  const resolvedSql = createMemo(() =>
    query.sql.replace(`auth.user_id()`, userId()!),
  );
  const streamName = createMemo(() => getSyncStreamNameForSql(query.sql));
  createEffect(() => {
    console.log(`streamName`, streamName());
    console.log(`resolvedSql:`, resolvedSql());
  });
  return useQuery<T>(resolvedSql, undefined, () => ({
    streams: [{ name: streamName() }],
  }));
}

export function createIsoMutation(sql: () => string): IsoMutation {
  return {
    get sql() {
      return sql();
    },
  } as const;
}
