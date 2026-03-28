"use server";

import { readdir, readFile, stat, access } from "fs/promises";
import { join, relative, extname } from "path";
import { getChannelWorkspacePath } from "./workspace";

/**
 * Represents a file or directory entry in the workspace.
 */
export type WorkspaceFileEntry = {
  /** File or directory name */
  name: string;
  /** Relative path from workspace root */
  path: string;
  /** Whether this entry is a file or directory */
  type: "file" | "directory";
  /** File size in bytes (0 for directories) */
  size: number;
  /** Last modified timestamp (ISO string) */
  modifiedAt: string;
};

/**
 * Represents the contents of a workspace file.
 */
export type WorkspaceFileContent = {
  /** Relative path from workspace root */
  path: string;
  /** File name */
  name: string;
  /** File content as string */
  content: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp (ISO string) */
  modifiedAt: string;
};

/**
 * Resolves and validates a file path within the workspace.
 * Prevents path traversal attacks by ensuring the resolved path
 * stays within the workspace root.
 *
 * @param workspacePath - Absolute path to the workspace root
 * @param relativePath - User-provided relative path
 * @returns The resolved absolute path
 * @throws If the path escapes the workspace root
 */
function resolveWorkspacePath(
  workspacePath: string,
  relativePath: string,
): string {
  // Normalize and resolve the path
  const resolved = join(workspacePath, relativePath);

  // Ensure the resolved path is within the workspace
  const rel = relative(workspacePath, resolved);
  if (rel.startsWith("..") || rel.startsWith("/")) {
    throw new Error("Path traversal not allowed");
  }

  return resolved;
}

/**
 * Checks whether a workspace directory exists for the given channel.
 *
 * @param channelId - The channel ID
 * @returns true if the workspace directory exists
 */
export async function workspaceExists(channelId: string): Promise<boolean> {
  const workspacePath = getChannelWorkspacePath(channelId);
  try {
    await access(workspacePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists files and directories in a channel's workspace directory.
 *
 * Returns entries for the given directory path (defaults to root).
 * Each entry includes name, relative path, type, size, and modification time.
 *
 * @param channelId - The channel ID whose workspace to list
 * @param dirPath - Relative directory path within the workspace (defaults to ".")
 * @returns Array of file/directory entries sorted by type (directories first) then name
 */
export async function listWorkspaceFiles(
  channelId: string,
  dirPath: string = ".",
): Promise<WorkspaceFileEntry[]> {
  const workspacePath = getChannelWorkspacePath(channelId);

  // Check if workspace exists
  const exists = await workspaceExists(channelId);
  if (!exists) {
    return [];
  }

  const targetPath = resolveWorkspacePath(workspacePath, dirPath);

  try {
    const entries = await readdir(targetPath, { withFileTypes: true });

    const results: WorkspaceFileEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files and directories (e.g., .git, .DS_Store)
      if (entry.name.startsWith(".")) continue;

      const entryPath = join(targetPath, entry.name);
      const relativePath = relative(workspacePath, entryPath);

      try {
        const stats = await stat(entryPath);
        results.push({
          name: entry.name,
          path: relativePath,
          type: entry.isDirectory() ? "directory" : "file",
          size: entry.isDirectory() ? 0 : stats.size,
          modifiedAt: stats.mtime.toISOString(),
        });
      } catch {
        // Skip entries we can't stat (e.g., broken symlinks)
        continue;
      }
    }

    // Sort: directories first, then alphabetically by name
    results.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return results;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Recursively lists all files in a channel's workspace.
 *
 * Walks the entire workspace directory tree and returns a flat list
 * of all file entries (no directories). Useful for showing a complete
 * file tree in the UI.
 *
 * @param channelId - The channel ID whose workspace to list
 * @param dirPath - Starting directory path (defaults to ".")
 * @param maxDepth - Maximum recursion depth (defaults to 10)
 * @returns Flat array of all file entries in the workspace
 */
export async function listWorkspaceFilesRecursive(
  channelId: string,
  dirPath: string = ".",
  maxDepth: number = 10,
): Promise<WorkspaceFileEntry[]> {
  if (maxDepth <= 0) return [];

  const workspacePath = getChannelWorkspacePath(channelId);
  const exists = await workspaceExists(channelId);
  if (!exists) {
    return [];
  }

  const targetPath = resolveWorkspacePath(workspacePath, dirPath);
  const results: WorkspaceFileEntry[] = [];

  try {
    const entries = await readdir(targetPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files and directories
      if (entry.name.startsWith(".")) continue;

      const entryPath = join(targetPath, entry.name);
      const relativePath = relative(workspacePath, entryPath);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subEntries = await listWorkspaceFilesRecursive(
          channelId,
          relativePath,
          maxDepth - 1,
        );
        results.push(...subEntries);
      } else {
        try {
          const stats = await stat(entryPath);
          results.push({
            name: entry.name,
            path: relativePath,
            type: "file",
            size: stats.size,
            modifiedAt: stats.mtime.toISOString(),
          });
        } catch {
          continue;
        }
      }
    }
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return results;
}

/** Maximum file size allowed for reading (1MB) */
const MAX_READ_SIZE = 1024 * 1024;

/** File extensions considered safe to read as text */
const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".csv",
  ".xml",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".sql",
  ".sh",
  ".bash",
  ".zsh",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".env",
  ".env.local",
  ".gitignore",
  ".dockerignore",
  ".editorconfig",
  ".prettierrc",
  ".eslintrc",
  ".log",
  ".conf",
  ".cfg",
  ".ini",
  ".svg",
]);

/**
 * Reads the contents of a file in a channel's workspace.
 *
 * Only reads text files under the size limit. Returns the file content
 * along with metadata (path, name, size, modification time).
 *
 * @param channelId - The channel ID whose workspace to read from
 * @param filePath - Relative path to the file within the workspace
 * @returns File content and metadata
 * @throws If the file doesn't exist, is too large, or is a binary file
 */
export async function readWorkspaceFile(
  channelId: string,
  filePath: string,
): Promise<WorkspaceFileContent> {
  const workspacePath = getChannelWorkspacePath(channelId);
  const resolvedPath = resolveWorkspacePath(workspacePath, filePath);

  const stats = await stat(resolvedPath);

  if (stats.isDirectory()) {
    throw new Error("Cannot read a directory as a file");
  }

  if (stats.size > MAX_READ_SIZE) {
    throw new Error(
      `File too large to read (${(stats.size / 1024).toFixed(1)}KB). Maximum size is ${MAX_READ_SIZE / 1024}KB.`,
    );
  }

  // Check file extension for text-safe reading
  const ext = extname(filePath).toLowerCase();
  const fileName = filePath.split("/").pop() || filePath;

  // Allow files with known text extensions or no extension (often text)
  if (ext && !TEXT_EXTENSIONS.has(ext)) {
    throw new Error(
      `Cannot read binary file type: ${ext}. Only text files are supported.`,
    );
  }

  const content = await readFile(resolvedPath, "utf-8");

  return {
    path: relative(workspacePath, resolvedPath),
    name: fileName,
    content,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };
}
