export function normalizeSyncStreamSql(sql: string) {
  const lines = sql
    .split("\n")
    .filter((line, index, allLines) => {
      if (line.trim().length > 0) {
        return true;
      }

      return index !== 0 && index !== allLines.length - 1;
    });
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;

  return lines.map((line) => line.slice(minIndent)).join("\n");
}

export function getSyncStreamNameForSql(sql: string) {
  const normalizedSql = normalizeSyncStreamSql(sql);
  let hash = 0xcbf29ce484222325n;

  for (const char of normalizedSql) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return `query_${hash.toString(16).padStart(16, "0")}`;
}
