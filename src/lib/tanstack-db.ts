import { createCollection } from "@tanstack/solid-db";
import { powerSyncCollectionOptions } from "@tanstack/powersync-db-collection";
import { getPowerSync, powerchatSchema, powerSyncDb } from "~/lib/powersync";

export type AppDatabase = (typeof powerchatSchema)["types"];

export const usersCollection = createCollection(
  powerSyncCollectionOptions({
    id: "users",
    database: powerSyncDb,
    table: powerchatSchema.props.users,
  }),
);

export const agentsCollection = createCollection(
  powerSyncCollectionOptions({
    id: "agents",
    database: powerSyncDb,
    table: powerchatSchema.props.agents,
  }),
);

export const channelsCollection = createCollection(
  powerSyncCollectionOptions({
    id: "channels",
    database: powerSyncDb,
    table: powerchatSchema.props.channels,
  }),
);

export const channelMembersCollection = createCollection(
  powerSyncCollectionOptions({
    id: "channel-members",
    database: powerSyncDb,
    table: powerchatSchema.props.channel_members,
  }),
);

export const messagesCollection = createCollection(
  powerSyncCollectionOptions({
    id: "messages",
    database: powerSyncDb,
    table: powerchatSchema.props.messages,
  }),
);

export const documentsCollection = createCollection(
  powerSyncCollectionOptions({
    id: "documents",
    database: powerSyncDb,
    table: powerchatSchema.props.documents,
  }),
);

let readyPromise: Promise<void> | null = null;

export async function ensureTanStackDbReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await getPowerSync();
      await Promise.all([
        usersCollection.stateWhenReady(),
        agentsCollection.stateWhenReady(),
        channelsCollection.stateWhenReady(),
        channelMembersCollection.stateWhenReady(),
        messagesCollection.stateWhenReady(),
        documentsCollection.stateWhenReady(),
      ]);
    })();
  }

  return readyPromise;
}
