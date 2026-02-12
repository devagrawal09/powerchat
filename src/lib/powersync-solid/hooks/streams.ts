import { createEffect, createMemo, createSignal, onCleanup, type Accessor } from 'solid-js';
import type {
  AbstractPowerSyncDatabase,
  SyncStatus,
  SyncStreamStatus,
  SyncStreamSubscription
} from '@powersync/common';
import type { QuerySyncStreamOptions, UseSyncStreamOptions } from '../types.js';
import { usePowerSync } from '../context.js';
import { useStatus } from './useStatus.js';

export function useSyncStream(options: UseSyncStreamOptions) {
  const db = usePowerSync();
  const status = useStatus();
  const [subscription, setSubscription] = createSignal<SyncStreamSubscription | null>(null);

  createEffect(() => {
    if (!db) {
      setSubscription(null);
      return;
    }

    let active = true;
    let currentSubscription: SyncStreamSubscription | null = null;

    db.syncStream(options.name, options.parameters)
      .subscribe(options)
      .then((sub) => {
        if (active) {
          currentSubscription = sub;
          setSubscription(sub);
        } else {
          sub.unsubscribe();
        }
      });

    onCleanup(() => {
      active = false;
      currentSubscription?.unsubscribe();
    });
  });

  return createMemo<SyncStreamStatus | null>(() => {
    const sub = subscription();
    if (!sub) {
      return null;
    }
    return status().forStream(sub);
  });
}

export function useAllSyncStreamsHaveSynced(
  db: Accessor<AbstractPowerSyncDatabase | null>,
  streams: Accessor<QuerySyncStreamOptions[] | undefined>
) {
  const [synced, setSynced] = createSignal(true);
  const hash = createMemo(() => {
    const currentStreams = streams();
    return currentStreams ? JSON.stringify(currentStreams) : '';
  });

  createEffect(() => {
    hash();
    const currentDb = db();
    const currentStreams = streams();

    if (!currentDb || !currentStreams || currentStreams.length === 0) {
      setSynced(true);
      return;
    }

    setSynced(currentStreams.every((entry) => entry.waitForStream != true));

    const abort = new AbortController();
    const promises: Promise<SyncStreamSubscription>[] = [];

    for (const stream of currentStreams) {
      promises.push(currentDb.syncStream(stream.name, stream.parameters).subscribe(stream));
    }

    Promise.all(promises).then(async (resolvedStreams) => {
      function allHaveSynced(status: SyncStatus) {
        return resolvedStreams.every((s, i) => {
          const request = currentStreams[i];
          return !request.waitForStream || status.forStream(s)?.subscription?.hasSynced;
        });
      }

      await currentDb.waitForStatus(allHaveSynced, abort.signal);
      if (!abort.signal.aborted) {
        setSynced(true);

        await new Promise<void>((resolve) => {
          abort.signal.addEventListener('abort', () => resolve());
        });
      }

      for (const stream of resolvedStreams) {
        stream.unsubscribe();
      }
    });

    onCleanup(() => abort.abort());
  });

  return synced;
}
