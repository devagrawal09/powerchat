import { createContext, useContext } from "solid-js";
import type { AbstractPowerSyncDatabase } from "@powersync/common";

export const PowerSyncContext = createContext<AbstractPowerSyncDatabase | null>(
  null,
);

export const usePowerSync = () => {
  const ctx = useContext(PowerSyncContext);

  if (!ctx) {
    throw new Error("usePowerSync must be used within a PowerSyncProvider");
  }

  return ctx;
};
