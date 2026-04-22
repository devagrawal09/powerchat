import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";
import {
  isLikelyViewableTextFilePath,
  type WorkspaceFileSelection,
} from "~/lib/workspace-file-viewability";
import { useChannelWorkspaceNodes } from "./useChannelWorkspaceNodes";
import { buildWorkspaceTree, type WorkspaceTreeNode } from "./tree";

type ChannelWorkspaceTreeProps = {
  channelId: string;
  onFileSelect?: (file: WorkspaceFileSelection) => void;
};

type WorkspaceTreeBranchProps = {
  node: WorkspaceTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onFileSelect?: (file: WorkspaceFileSelection) => void;
};

function WorkspaceTreeBranch(props: WorkspaceTreeBranchProps) {
  const isExpanded = () => props.expandedPaths.has(props.node.path);
  const paddingLeft = () => `${props.depth * 0.75}rem`;
  const isViewableTextFile = () =>
    props.node.kind === "file" && isLikelyViewableTextFilePath(props.node.path);

  const handleFileClick = () => {
    if (!isViewableTextFile()) {
      return;
    }

    props.onFileSelect?.({
      path: props.node.path,
      name: props.node.name,
    });
  };

  return (
    <div>
      <Show
        when={props.node.kind === "dir"}
        fallback={
          <Show
            when={isViewableTextFile()}
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
              onClick={handleFileClick}
            >
              <span class="truncate">{props.node.name}</span>
            </button>
          </Show>
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
                onFileSelect={props.onFileSelect}
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

  return (
    <section class="mt-4">
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs font-semibold text-gray-500 uppercase mb-2">
          Workspace
        </div>
      </div>

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
                onFileSelect={props.onFileSelect}
              />
            )}
          </For>
        </Match>
      </Switch>
    </section>
  );
}
