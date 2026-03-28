"use server";
import { Workspace, LocalFilesystem, LocalSandbox } from "@mastra/core/workspace";
import { mkdir } from "fs/promises";
import { join, resolve } from "path";

/**
 * Base directory for all per-channel workspace storage.
 * Each channel gets its own subdirectory: workspaces/<channel_id>/
 */
const WORKSPACES_BASE = resolve(process.cwd(), "workspaces");

/**
 * Directory containing SKILL.md files available to all workspaces.
 * Skills follow the Agent Skills specification (https://agentskills.io).
 */
const SKILLS_DIR = resolve(process.cwd(), "skills");

/**
 * Cache of initialized Workspace instances, keyed by channel ID.
 * Prevents creating duplicate workspace instances for the same channel.
 */
const workspaceCache = new Map<string, Workspace>();

/**
 * In-flight initialization promises, keyed by channel ID.
 * Prevents concurrent initialization of the same workspace.
 */
const initPromises = new Map<string, Promise<Workspace>>();

/**
 * Returns the base path on disk for a channel's workspace files.
 */
export function getChannelWorkspacePath(channelId: string): string {
  return join(WORKSPACES_BASE, channelId);
}

/**
 * Creates and initializes a Mastra Workspace scoped to a specific channel.
 *
 * The workspace provides agents with:
 * - **LocalFilesystem**: Persistent file storage under workspaces/<channel_id>/
 * - **LocalSandbox**: Command execution within the channel's workspace directory
 * - **BM25 search**: Keyword search across indexed workspace content
 * - **Skills**: Reusable instruction sets from the skills/ directory
 *
 * Workspace instances are cached per channel ID and reused across agent invocations.
 *
 * @param channelId - The channel ID to scope the workspace to
 * @returns An initialized Workspace instance
 */
export async function getWorkspace(channelId: string): Promise<Workspace> {
  // Return cached instance if available
  const cached = workspaceCache.get(channelId);
  if (cached) return cached;

  // Return in-flight promise if workspace is currently initializing
  const pending = initPromises.get(channelId);
  if (pending) return pending;

  const promise = createWorkspace(channelId);
  initPromises.set(channelId, promise);

  try {
    const workspace = await promise;
    workspaceCache.set(channelId, workspace);
    return workspace;
  } finally {
    initPromises.delete(channelId);
  }
}

/**
 * Internal factory that constructs and initializes a new Workspace.
 */
async function createWorkspace(channelId: string): Promise<Workspace> {
  const basePath = getChannelWorkspacePath(channelId);

  // Ensure the channel workspace directory exists on disk
  await mkdir(basePath, { recursive: true });

  // Ensure the skills directory exists (may be empty initially)
  await mkdir(SKILLS_DIR, { recursive: true });

  console.log("[workspace] Creating workspace for channel", {
    channelId,
    basePath,
    skillsDir: SKILLS_DIR,
  });

  const filesystem = new LocalFilesystem({
    basePath,
    contained: true,
    allowedPaths: [SKILLS_DIR],
  });

  const sandbox = new LocalSandbox({
    workingDirectory: basePath,
  });

  const workspace = new Workspace({
    id: `channel-${channelId}`,
    name: `Channel ${channelId}`,
    filesystem,
    sandbox,
    bm25: true,
    autoIndexPaths: ["./**/*.md", "./**/*.txt", "./**/*.ts", "./**/*.js"],
    skills: [SKILLS_DIR],
    tools: {
      execute_command: { requireApproval: false },
    },
  });

  await workspace.init();

  console.log("[workspace] Workspace initialized for channel", { channelId });
  return workspace;
}

/**
 * Destroys the workspace for a channel and removes it from cache.
 * Call this when a channel is deleted or workspace needs to be reset.
 */
export async function destroyWorkspace(channelId: string): Promise<void> {
  const workspace = workspaceCache.get(channelId);
  if (workspace) {
    console.log("[workspace] Destroying workspace for channel", { channelId });
    await workspace.destroy();
    workspaceCache.delete(channelId);
  }
}

/**
 * Destroys all cached workspaces. Useful for server shutdown / cleanup.
 */
export async function destroyAllWorkspaces(): Promise<void> {
  console.log("[workspace] Destroying all workspaces", {
    count: workspaceCache.size,
  });
  const destroyPromises = Array.from(workspaceCache.keys()).map((channelId) =>
    destroyWorkspace(channelId),
  );
  await Promise.allSettled(destroyPromises);
}
