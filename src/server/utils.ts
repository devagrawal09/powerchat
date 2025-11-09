import { getCookie } from "vinxi/http";
import { getRequestEvent } from "solid-js/web";

export function getUsername(): string {
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");
  const username = getCookie(event.nativeEvent, "pc_username");
  if (!username) throw new Error("No session");
  return username;
}
