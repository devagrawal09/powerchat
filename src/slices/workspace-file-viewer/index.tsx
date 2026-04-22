import { Match, Switch } from "solid-js";
import { readChannelWorkspaceTextFile } from "~/server/workspace-file-actions";
import { createAsync } from "@solidjs/router";

function formatSize(sizeBytes: number) {
  return `${sizeBytes.toLocaleString()} bytes`;
}

type WorkspaceFileViewerProps = {
  channelId: string;
  filePath: string;
  onClose: () => void;
};

export function WorkspaceFileViewer(props: WorkspaceFileViewerProps) {
  const file = createAsync(() =>
    readChannelWorkspaceTextFile(props.channelId, props.filePath),
  );

  return (
    <div class="flex h-full flex-col bg-white">
      <div class="flex items-start justify-between gap-4 border-b border-gray-200 p-4">
        <div class="min-w-0">
          <h2 class="truncate text-lg font-semibold text-gray-900">
            {file()?.name ?? props.filePath.split("/").at(-1) ?? "File"}
          </h2>
          <p class="truncate text-xs text-gray-500">{props.filePath}</p>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          class="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          Close
        </button>
      </div>

      <Switch>
        <Match when={file()?.sizeBytes != null}>
          <div class="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
            {formatSize(file()!.sizeBytes)}
            <span class="mx-2 text-gray-300">•</span>
            {file()!.modifiedAt}
          </div>
        </Match>
      </Switch>

      <div class="flex-1 overflow-auto bg-gray-50">
        <Switch>
          <Match when={file()}>
            {(workspaceFile) => (
              <pre class="min-h-full overflow-auto p-4 font-mono text-sm leading-6 whitespace-pre text-gray-900">
                {workspaceFile().content}
              </pre>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  );
}
