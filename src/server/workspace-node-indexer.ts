import chokidar, { type FSWatcher } from "chokidar";
import { and, eq, like, or } from "drizzle-orm";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { workspaceNodes } from "~/db/schema/server";
import { db } from "./db";

export const channelWorkspaceRoot = path.resolve(
  process.cwd(),
  ".mastra-workspaces",
  "channels",
);

export type WorkspaceNodeTarget = {
  channelId: string;
  relativePath: string | null;
};

export type WorkspaceFileTarget = WorkspaceNodeTarget & {
  relativePath: string;
};

type WorkspaceStatLike = {
  isDirectory(): boolean;
  size: number;
  mtime: Date;
};

type WorkspaceNodeRow = typeof workspaceNodes.$inferInsert;

type WorkspaceDatabase = typeof db;

let watcherStartPromise: Promise<FSWatcher | null> | null = null;
let watcherStartupFailed = false;

function isPathInside(rootPath: string, candidatePath: string) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath !== "" &&
    !relativePath.startsWith(`..${path.sep}`) &&
    relativePath !== ".." &&
    !path.isAbsolute(relativePath)
  );
}

function decodeChannelId(encodedChannelId: string) {
  try {
    return decodeURIComponent(encodedChannelId);
  } catch {
    return null;
  }
}

export function normalizeWorkspaceRelativePath(relativePath: string) {
  const normalizedSlashes = relativePath.replace(/\\/g, "/").trim();
  const withoutLeadingDots = normalizedSlashes.replace(/^\.\//, "");
  const withoutLeadingSlashes = withoutLeadingDots.replace(/^\/+/, "");
  const normalizedPath = path.posix.normalize(withoutLeadingSlashes);

  if (
    !normalizedPath ||
    normalizedPath === "." ||
    normalizedPath === ".." ||
    normalizedPath.startsWith("../") ||
    path.posix.isAbsolute(normalizedPath)
  ) {
    throw new Error(`Invalid workspace relative path: ${relativePath}`);
  }

  return normalizedPath;
}

function getWorkspaceNodeId(channelId: string, relativePath: string) {
  return `${encodeURIComponent(channelId)}:${normalizeWorkspaceRelativePath(relativePath)}`;
}

function getWorkspaceParentPath(relativePath: string) {
  const normalizedPath = normalizeWorkspaceRelativePath(relativePath);
  const parentPath = path.posix.dirname(normalizedPath);
  return parentPath === "." ? null : parentPath;
}

export function getWorkspaceTargetFromAbsolutePath(
  absolutePath: string,
  workspaceRoot: string = channelWorkspaceRoot,
): WorkspaceNodeTarget | null {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const resolvedAbsolutePath = path.resolve(absolutePath);

  if (!isPathInside(resolvedWorkspaceRoot, resolvedAbsolutePath)) {
    return null;
  }

  const relativeToWorkspaceRoot = path.relative(
    resolvedWorkspaceRoot,
    resolvedAbsolutePath,
  );
  const pathSegments = relativeToWorkspaceRoot.split(path.sep).filter(Boolean);

  if (pathSegments.length === 0) {
    return null;
  }

  const channelId = decodeChannelId(pathSegments[0]);
  if (!channelId) {
    return null;
  }

  if (pathSegments.length === 1) {
    return {
      channelId,
      relativePath: null,
    };
  }

  return {
    channelId,
    relativePath: normalizeWorkspaceRelativePath(
      pathSegments.slice(1).join("/"),
    ),
  };
}

export function isWorkspaceFileTarget(
  target: WorkspaceNodeTarget,
): target is WorkspaceFileTarget {
  return target.relativePath !== null;
}

export function createWorkspaceNodeRow(
  target: WorkspaceFileTarget,
  stats: WorkspaceStatLike,
): WorkspaceNodeRow {
  const normalizedPath = normalizeWorkspaceRelativePath(target.relativePath);

  return {
    id: getWorkspaceNodeId(target.channelId, normalizedPath),
    channelId: target.channelId,
    path: normalizedPath,
    parentPath: getWorkspaceParentPath(normalizedPath),
    name: path.posix.basename(normalizedPath),
    kind: stats.isDirectory() ? "dir" : "file",
    sizeBytes: stats.isDirectory() ? null : stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };
}

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function walkWorkspaceDirectory(
  channelId: string,
  absoluteDirectoryPath: string,
  relativeDirectoryPath?: string,
): Promise<WorkspaceNodeRow[]> {
  const entries = await readdir(absoluteDirectoryPath, { withFileTypes: true });
  const rows: WorkspaceNodeRow[] = [];

  const sortedEntries = entries.toSorted((left, right) => {
    if (left.name < right.name) {
      return -1;
    }

    if (left.name > right.name) {
      return 1;
    }

    return 0;
  });

  for (const entry of sortedEntries) {
    const relativeEntryPath = relativeDirectoryPath
      ? `${relativeDirectoryPath}/${entry.name}`
      : entry.name;
    const absoluteEntryPath = path.join(absoluteDirectoryPath, entry.name);
    const entryStats = await stat(absoluteEntryPath);
    const row = createWorkspaceNodeRow(
      {
        channelId,
        relativePath: relativeEntryPath,
      },
      entryStats,
    );

    rows.push(row);

    if (entryStats.isDirectory()) {
      rows.push(
        ...(await walkWorkspaceDirectory(
          channelId,
          absoluteEntryPath,
          row.path,
        )),
      );
    }
  }

  return rows;
}

export async function scanWorkspaceChannelDirectory(
  channelId: string,
  channelDirectoryPath: string,
) {
  if (!(await pathExists(channelDirectoryPath))) {
    return [];
  }

  return walkWorkspaceDirectory(channelId, channelDirectoryPath);
}

async function upsertWorkspaceNode(
  target: WorkspaceFileTarget,
  workspaceDatabase: WorkspaceDatabase = db,
  absolutePath?: string,
) {
  const targetPath = absolutePath
    ? absolutePath
    : path.join(
        channelWorkspaceRoot,
        encodeURIComponent(target.channelId),
        target.relativePath,
      );
  const entryStats = await stat(targetPath);
  const row = createWorkspaceNodeRow(target, entryStats);

  await workspaceDatabase
    .insert(workspaceNodes)
    .values(row)
    .onConflictDoUpdate({
      target: [workspaceNodes.channelId, workspaceNodes.path],
      set: {
        id: row.id,
        parentPath: row.parentPath,
        name: row.name,
        kind: row.kind,
        sizeBytes: row.sizeBytes,
        modifiedAt: row.modifiedAt,
      },
    });
}

async function deleteWorkspaceSubtree(
  channelId: string,
  relativePath: string,
  workspaceDatabase: WorkspaceDatabase = db,
) {
  await workspaceDatabase
    .delete(workspaceNodes)
    .where(
      and(
        eq(workspaceNodes.channelId, channelId),
        or(
          eq(workspaceNodes.path, relativePath),
          like(workspaceNodes.path, `${relativePath}/%`),
        ),
      ),
    );
}

async function deleteChannelWorkspaceIndex(
  channelId: string,
  workspaceDatabase: WorkspaceDatabase = db,
) {
  await workspaceDatabase
    .delete(workspaceNodes)
    .where(eq(workspaceNodes.channelId, channelId));
}

export async function refreshChannelWorkspaceIndex(
  channelId: string,
  workspaceDatabase: WorkspaceDatabase = db,
) {
  const channelDirectoryPath = path.join(
    channelWorkspaceRoot,
    encodeURIComponent(channelId),
  );
  const rows = await scanWorkspaceChannelDirectory(
    channelId,
    channelDirectoryPath,
  );

  await workspaceDatabase.transaction(async (tx) => {
    await tx
      .delete(workspaceNodes)
      .where(eq(workspaceNodes.channelId, channelId));

    if (rows.length > 0) {
      await tx.insert(workspaceNodes).values(rows);
    }
  });

  return rows;
}

export async function refreshAllWorkspaceIndexes(
  workspaceDatabase: WorkspaceDatabase = db,
  workspaceRoot: string = channelWorkspaceRoot,
) {
  await mkdir(workspaceRoot, { recursive: true });

  const channelDirectories = await readdir(workspaceRoot, {
    withFileTypes: true,
  });
  const allRows: WorkspaceNodeRow[] = [];

  for (const entry of channelDirectories.toSorted((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!entry.isDirectory()) {
      continue;
    }

    const channelId = decodeChannelId(entry.name);
    if (!channelId) {
      continue;
    }

    const channelDirectoryPath = path.join(workspaceRoot, entry.name);
    allRows.push(
      ...(await scanWorkspaceChannelDirectory(channelId, channelDirectoryPath)),
    );
  }

  await workspaceDatabase.transaction(async (tx) => {
    await tx.delete(workspaceNodes);

    if (allRows.length > 0) {
      await tx.insert(workspaceNodes).values(allRows);
    }
  });

  return allRows;
}

async function handleWorkspaceNodeUpsert(
  absolutePath: string,
  workspaceDatabase: WorkspaceDatabase,
) {
  const target = getWorkspaceTargetFromAbsolutePath(absolutePath);
  if (!target) {
    return;
  }

  if (!isWorkspaceFileTarget(target)) {
    await refreshChannelWorkspaceIndex(target.channelId, workspaceDatabase);
    return;
  }

  await upsertWorkspaceNode(target, workspaceDatabase, absolutePath);
}

async function handleWorkspaceNodeDelete(
  absolutePath: string,
  workspaceDatabase: WorkspaceDatabase,
) {
  const target = getWorkspaceTargetFromAbsolutePath(absolutePath);
  if (!target) {
    return;
  }

  if (target.relativePath === null) {
    await deleteChannelWorkspaceIndex(target.channelId, workspaceDatabase);
    return;
  }

  await deleteWorkspaceSubtree(
    target.channelId,
    target.relativePath,
    workspaceDatabase,
  );
}

function logWorkspaceIndexerError(
  action: string,
  absolutePath: string,
  error: unknown,
) {
  console.error(`[workspace-node-indexer] ${action} failed`, {
    absolutePath,
    error,
  });
}

export async function ensureWorkspaceNodeIndexerStarted(
  workspaceDatabase: WorkspaceDatabase = db,
) {
  if (process.env.VITEST === "true") {
    return null;
  }

  if (watcherStartupFailed) {
    return null;
  }

  if (!watcherStartPromise) {
    watcherStartPromise = (async () => {
      try {
        await mkdir(channelWorkspaceRoot, { recursive: true });
        await refreshAllWorkspaceIndexes(
          workspaceDatabase,
          channelWorkspaceRoot,
        );

        const workspaceWatcher = chokidar.watch(channelWorkspaceRoot, {
          ignoreInitial: true,
          persistent: true,
        });

        workspaceWatcher.on("add", (absolutePath) => {
          handleWorkspaceNodeUpsert(absolutePath, workspaceDatabase).catch(
            (error) => {
              logWorkspaceIndexerError("add", absolutePath, error);
            },
          );
        });
        workspaceWatcher.on("change", (absolutePath) => {
          handleWorkspaceNodeUpsert(absolutePath, workspaceDatabase).catch(
            (error) => {
              logWorkspaceIndexerError("change", absolutePath, error);
            },
          );
        });
        workspaceWatcher.on("addDir", (absolutePath) => {
          handleWorkspaceNodeUpsert(absolutePath, workspaceDatabase).catch(
            (error) => {
              logWorkspaceIndexerError("addDir", absolutePath, error);
            },
          );
        });
        workspaceWatcher.on("unlink", (absolutePath) => {
          handleWorkspaceNodeDelete(absolutePath, workspaceDatabase).catch(
            (error) => {
              logWorkspaceIndexerError("unlink", absolutePath, error);
            },
          );
        });
        workspaceWatcher.on("unlinkDir", (absolutePath) => {
          handleWorkspaceNodeDelete(absolutePath, workspaceDatabase).catch(
            (error) => {
              logWorkspaceIndexerError("unlinkDir", absolutePath, error);
            },
          );
        });
        workspaceWatcher.on("error", (error) => {
          console.error("[workspace-node-indexer] watcher error", error);
        });

        return workspaceWatcher;
      } catch (error) {
        watcherStartupFailed = true;
        console.warn("[workspace-node-indexer] disabled", error);
        return null;
      }
    })();
  }

  return watcherStartPromise;
}
