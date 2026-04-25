"use server";

import { getCookie } from "@solidjs/start/http";
import { ensureWorkspaceNodeIndexerStarted } from "./workspace-node-indexer";

export function getRequestUsername(): string {
  void ensureWorkspaceNodeIndexerStarted();

  const username = getCookie("pc_username");
  if (!username) throw new Error("No session");

  return username;
}
