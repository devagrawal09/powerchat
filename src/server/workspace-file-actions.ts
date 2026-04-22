"use server";

import { getRequestUsername } from "./request-auth";
import { readWorkspaceTextFileForUser } from "./workspace-file-reader";

export async function readChannelWorkspaceTextFile(
  channelId: string,
  relativePath: string,
) {
  const username = getRequestUsername();

  return readWorkspaceTextFileForUser({
    channelId,
    relativePath,
    username,
  });
}
