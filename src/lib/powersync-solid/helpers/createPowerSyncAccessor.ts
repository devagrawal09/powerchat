import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { AbstractPowerSyncDatabase } from '@powersync/common';

export type PowerSyncAccessor = {
  db: Accessor<AbstractPowerSyncDatabase | null>;
  ready: Accessor<boolean>;
  error: Accessor<unknown | null>;
  connect: () => Promise<void>;
};

export const createPowerSyncAccessor = (
  create: () => Promise<AbstractPowerSyncDatabase>
): PowerSyncAccessor => {
  const [db, setDb] = createSignal<AbstractPowerSyncDatabase | null>(null);
  const [ready, setReady] = createSignal(false);
  const [error, setError] = createSignal<unknown | null>(null);

  let pending: Promise<void> | null = null;

  const connect = async () => {
    if (db()) {
      return;
    }

    if (pending) {
      return pending;
    }

    pending = (async () => {
      try {
        const instance = await create();
        setDb(instance);
        setReady(true);
      } catch (err) {
        setError(err);
        setReady(false);
        throw err;
      } finally {
        pending = null;
      }
    })();

    return pending;
  };

  return {
    db,
    ready,
    error,
    connect
  };
};
