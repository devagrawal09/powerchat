import { getCookie } from "@solidjs/start/http";

export function getUsername(): string {
  const username = getCookie("pc_username");
  if (!username) throw new Error("No session");
  return username;
}
