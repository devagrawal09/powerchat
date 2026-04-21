import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";
import { refreshChannelWorkspaceIndex } from "~/server/workspace-node-actions";
import {
  type WorkspaceNodeRow,
  useChannelWorkspaceNodes,
} from "./useChannelWorkspaceNodes";
import { buildWorkspaceTree, type WorkspaceTreeNode } from "./tree";

type ChannelWorkspaceTreeProps = {
  channelId: string;
};

function formatNodeMeta(node: WorkspaceNodeRow) {
  if (node.kind === "dir") {
    return "Folder";
  }

  return node.sizeBytes == null ? "File" : `${node.sizeBytes} B`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

type WorkspaceTreeBranchProps = {
  node: WorkspaceTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
};

function WorkspaceTreeBranch(props: WorkspaceTreeBranchProps) {
  const isExpanded = () => props.expandedPaths.has(props.node.path);
  const paddingLeft = () => `${props.depth * 0.75}rem`;

  return (
    <div>
      <Show
        when={props.node.kind === "dir"}
        fallback={
          <div
            class="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm text-gray-700"
            style={{ "padding-left": paddingLeft() }}
          >
            <span class="truncate">{props.node.name}</span>
          </div>
        }
      >
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm text-gray-700 hover:bg-gray-50"
          style={{ "padding-left": paddingLeft() }}
          aria-label={`Toggle ${props.node.name}`}
          aria-expanded={isExpanded()}
          onClick={() => props.onToggle(props.node.path)}
        >
          <span class="flex min-w-0 items-center gap-2">
            <span class="text-xs text-gray-400">
              {isExpanded() ? "▾" : "▸"}
            </span>
            <span class="truncate">{props.node.name}</span>
          </span>
        </button>
      </Show>

      <Show when={props.node.kind === "dir" && isExpanded()}>
        <div class="space-y-1">
          <For each={props.node.children}>
            {(childNode) => (
              <WorkspaceTreeBranch
                node={childNode}
                depth={props.depth + 1}
                expandedPaths={props.expandedPaths}
                onToggle={props.onToggle}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export function ChannelWorkspaceTree(props: ChannelWorkspaceTreeProps) {
  const workspaceNodes = useChannelWorkspaceNodes(props.channelId);
  const [expandedPaths, setExpandedPaths] = createSignal<Set<string>>(
    new Set(),
  );
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [refreshError, setRefreshError] = createSignal<string | null>(null);
  const tree = createMemo(() => buildWorkspaceTree(workspaceNodes().data));

  const togglePath = (targetPath: string) => {
    setExpandedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      if (nextPaths.has(targetPath)) {
        nextPaths.delete(targetPath);
      } else {
        nextPaths.add(targetPath);
      }
      return nextPaths;
    });
  };

  const handleRefresh = async () => {
    setRefreshError(null);
    setIsRefreshing(true);

    try {
      await refreshChannelWorkspaceIndex(props.channelId);
      await workspaceNodes().refresh?.();
    } catch (error) {
      setRefreshError(getErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <section class="mt-4">
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs font-semibold text-gray-500 uppercase mb-2">
          Workspace
        </div>
        <button
          type="button"
          class="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Refresh workspace"
          disabled={isRefreshing()}
          onClick={handleRefresh}
        >
          {isRefreshing() ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <Show when={refreshError()}>
        {(message) => <p class="mb-2 text-xs text-red-600">{message()}</p>}
      </Show>

      <Switch>
        <Match when={workspaceNodes().error}>
          <div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <div>Failed to load workspace.</div>
            <div class="text-xs">{workspaceNodes().error?.message}</div>
          </div>
        </Match>

        <Match
          when={
            workspaceNodes().isLoading && workspaceNodes().data.length === 0
          }
        >
          <div class="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
            Loading workspace…
          </div>
        </Match>

        <Match when={tree().length === 0}>
          <div class="rounded border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500">
            Workspace empty
          </div>
        </Match>

        <Match when={true}>
          <For each={tree()}>
            {(node) => (
              <WorkspaceTreeBranch
                node={node}
                depth={0}
                expandedPaths={expandedPaths()}
                onToggle={togglePath}
              />
            )}
          </For>
        </Match>
      </Switch>
    </section>
  );
}
