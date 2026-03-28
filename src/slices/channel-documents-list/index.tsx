import { For, Show, createResource, createEffect, on } from "solid-js";
import {
  listWorkspaceFiles,
  type WorkspaceFileEntry,
} from "~/server/workspace-files";

type ChannelDocumentsListProps = {
  channelId: string;
  onFileClick: (filePath: string) => void;
};

export function ChannelDocumentsList(props: ChannelDocumentsListProps) {
  const [files, { refetch }] = createResource(
    () => props.channelId,
    (channelId) => listWorkspaceFiles(channelId),
  );

  // Refetch when channelId changes
  createEffect(on(() => props.channelId, () => refetch()));

  return (
    <>
      <div class="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">
        Workspace Files
      </div>
      <Show when={!files.loading}>
        <For each={files() ?? []}>
          {(file) => (
            <div
              onClick={() => props.onFileClick(file.path)}
              class="text-sm text-gray-900 py-1 cursor-pointer hover:text-blue-600 hover:underline flex items-center gap-1"
            >
              <span class="text-gray-400">
                {file.type === "directory" ? "📁" : "📄"}
              </span>
              {file.name}
            </div>
          )}
        </For>
      </Show>
    </>
  );
}
