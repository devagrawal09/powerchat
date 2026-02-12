import type {
  AbstractPowerSyncDatabase,
  DifferentialWatchedQueryComparator,
  SQLOnChangeOptions,
  SyncStreamSubscribeOptions,
} from "@powersync/common";
import type { Accessor } from "solid-js";

export type SsrBehavior = "skip" | "fallback";

export type WatchedQueryState<T> = {
  data: ReadonlyArray<Readonly<T>>;
  isLoading: boolean;
  error?: Error;
};

export type TriggerBasedDiffOptions<T = unknown> = {
  source: string;
  initialQuery: string;
  initialParams?: unknown[];
  when: {
    INSERT?: string;
    UPDATE?: string;
    DELETE?: string;
  };
  columns?: string[];
  getId?: (row: T) => string;
  sortFn?: (a: T, b: T) => number;
};

export type UseWatchedQueryOptions = {
  db?: Accessor<AbstractPowerSyncDatabase | null>;
  ssr?: SsrBehavior;
};

export interface HookWatchOptions extends Omit<SQLOnChangeOptions, "signal"> {
  streams?: QuerySyncStreamOptions[];
  reportFetching?: boolean;
}

export interface QuerySyncStreamOptions extends UseSyncStreamOptions {
  waitForStream?: boolean;
}

export interface UseSyncStreamOptions extends SyncStreamSubscribeOptions {
  name: string;
  parameters?: Record<string, any> | null;
}

export interface AdditionalOptions extends HookWatchOptions {
  runQueryOnce?: boolean;
}

export interface DifferentialHookOptions<RowType> extends HookWatchOptions {
  rowComparator?: DifferentialWatchedQueryComparator<RowType>;
}

export type UseQueryOptions<RowType = unknown> = UseWatchedQueryOptions &
  AdditionalOptions &
  DifferentialHookOptions<RowType> & {
    active?: Accessor<boolean>;
  };

export type UseWatchedQueryHookOptions<RowType = unknown> =
  UseWatchedQueryOptions &
    Omit<DifferentialHookOptions<RowType>, "streams"> & {
      active?: Accessor<boolean>;
    };

export type UseSingleQueryOptions = UseWatchedQueryOptions & {
  active?: Accessor<boolean>;
};

export type QueryResult<RowType> = {
  data: RowType[];
  isLoading: boolean;
  error?: Error;
  refresh?: (signal?: AbortSignal) => Promise<void>;
};

export type ReadonlyQueryResult<RowType> = {
  readonly data: ReadonlyArray<Readonly<RowType>>;
  readonly isLoading: boolean;
  readonly error?: Error;
  refresh?: (signal?: AbortSignal) => Promise<void>;
};

export type UseTriggerBasedDiffOptions<T = unknown> =
  TriggerBasedDiffOptions<T> & {
    db?: Accessor<AbstractPowerSyncDatabase | null>;
    ssr?: SsrBehavior;
  };

export type TriggerBasedDiffState<T> = WatchedQueryState<T>;
