import { createHash } from "node:crypto";
import * as db from "../src/db";

const syncConfigPath = new URL("../powersync/sync-config.yaml", import.meta.url);

const generatedStartMarker = "  # BEGIN GENERATED STREAMS";
const generatedEndMarker = "  # END GENERATED STREAMS";

function indentBlock(value: string, spaces: number) {
  const indent = " ".repeat(spaces);
  return value
    .trim()
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
}

function normalizeSql(sql: string) {
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

function formatStream(name: string, sql: string, autoSubscribe = true) {
  return [
    `  ${name}:`,
    `    auto_subscribe: ${autoSubscribe ? "true" : "false"}`,
    "    query: |",
    indentBlock(normalizeSql(sql), 6),
  ].join("\n");
}

type SyncStreamExport = {
  sql: string;
  autoSubscribe?: boolean;
};

function isSyncStreamExport(value: unknown): value is SyncStreamExport {
  return Boolean(
    value &&
      typeof value === "object" &&
      "sql" in value &&
      typeof value.sql === "string",
  );
}

function getStreamName(sql: string) {
  const hash = createHash("sha256").update(sql).digest("hex").slice(0, 16);
  return `query_${hash}`;
}

const exportedQueries = Object.values(db).filter(isSyncStreamExport);

const generatedStreams = exportedQueries
  .map((query) => {
    const normalizedSql = normalizeSql(query.sql);
    return formatStream(
      getStreamName(normalizedSql),
      normalizedSql,
      query.autoSubscribe ?? true,
    );
  })
  .join("\n\n");

const syncConfig = await Bun.file(syncConfigPath).text();
const startIndex = syncConfig.indexOf(generatedStartMarker);
const endIndex = syncConfig.indexOf(generatedEndMarker);

if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
  throw new Error("Could not find generated stream markers in powersync/sync-config.yaml");
}

const generatedSection = generatedStreams
  ? `${generatedStartMarker}\n${generatedStreams}\n${generatedEndMarker}`
  : `${generatedStartMarker}\n${generatedEndMarker}`;

const updatedSyncConfig = [
  syncConfig.slice(0, startIndex),
  generatedSection,
  syncConfig.slice(endIndex + generatedEndMarker.length),
].join("");

await Bun.write(syncConfigPath, updatedSyncConfig);

console.log(`Generated ${exportedQueries.length} sync stream(s).`);
