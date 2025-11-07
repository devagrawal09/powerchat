export function getUsername(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)pc_username=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
