"use server";

import { getCookie } from "vinxi/http";
import { getRequestEvent } from "solid-js/web";
import { ensureWorkspaceNodeIndexerStarted } from "./workspace-node-indexer";

export function getRequestUsername(): string {
  void ensureWorkspaceNodeIndexerStarted();

  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const username = getCookie(event.nativeEvent, "pc_username");
  if (!username) throw new Error("No session");

  return username;
}
