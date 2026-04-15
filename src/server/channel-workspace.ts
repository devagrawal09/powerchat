import {
  LocalFilesystem,
  LocalSandbox,
  Workspace,
} from "@mastra/core/workspace";
import path from "node:path";

const workspaceCache = new Map<string, Promise<Workspace>>();
const workspaceRoot = path.resolve(
  process.cwd(),
  ".mastra-workspaces",
  "channels",
);

export function getChannelWorkspacePath(channelId: string) {
  return path.join(workspaceRoot, encodeURIComponent(channelId));
}

export function getChannelWorkspace(channelId: string) {
  let workspacePromise = workspaceCache.get(channelId);

  if (!workspacePromise) {
    const channelWorkspacePath = getChannelWorkspacePath(channelId);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({
        basePath: channelWorkspacePath,
      }),
      sandbox: new LocalSandbox({
        workingDirectory: channelWorkspacePath,
      }),
    });

    workspacePromise = workspace.init().then(() => workspace);
    workspaceCache.set(channelId, workspacePromise);
  }

  return workspacePromise;
}

export function resetChannelWorkspaceCache() {
  workspaceCache.clear();
}
