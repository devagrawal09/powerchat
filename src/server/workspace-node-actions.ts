"use server";

import { refreshChannelWorkspaceIndex as refreshWorkspaceIndex } from "./workspace-node-indexer";

export async function refreshChannelWorkspaceIndex(channelId: string) {
  await refreshWorkspaceIndex(channelId);
}
