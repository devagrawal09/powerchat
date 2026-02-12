import { createEffect, createSignal, onCleanup } from 'solid-js';
import { SyncStatus } from '@powersync/common';
import { usePowerSync } from '../context.js';

export const useStatus = () => {
  const powerSync = usePowerSync();
  const [status, setStatus] = createSignal(powerSync.currentStatus);

  createEffect(() => {
    const listener = powerSync.registerListener({ statusChanged: setStatus });
    onCleanup(() => listener());
  });

  return status;
};
