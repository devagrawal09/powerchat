import {
  toCompilableQuery,
  type DrizzleQuery,
} from "@powersync/drizzle-driver";
import { clientDb } from "~/lib/powersync";
export * from "~/db/schema/client";

export function liveQuery<T>(query: DrizzleQuery<T>) {
  return toCompilableQuery(query);
}

export { clientDb };
