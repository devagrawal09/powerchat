export function getUserId(): string {
  const match = document.cookie.match(/(?:^|;\s*)pc_uid=([^;]*)/);
  if (match) {
    return match[1];
  }

  // Fallback: generate new UUID if cookie not found
  const newId = crypto.randomUUID();
  document.cookie = `pc_uid=${newId}; path=/; max-age=${
    60 * 60 * 24 * 365
  }; SameSite=Lax`;
  return newId;
}
