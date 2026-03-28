import * as db from "../src/db";
import {
  getSyncStreamNameForSql,
  normalizeSyncStreamSql,
} from "../src/lib/sync-streams";

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

function formatStream(name: string, sql: string, autoSubscribe = true) {
  return [
    `  ${name}:`,
    `    auto_subscribe: ${autoSubscribe ? "true" : "false"}`,
    "    query: |",
    indentBlock(normalizeSyncStreamSql(sql), 6),
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

const exportedQueries = Object.values(db).filter(isSyncStreamExport);

const generatedStreams = exportedQueries
  .map((query) => {
    const normalizedSql = normalizeSyncStreamSql(query.sql);
    return formatStream(
      getSyncStreamNameForSql(normalizedSql),
      normalizedSql,
      query.autoSubscribe ?? false,
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
