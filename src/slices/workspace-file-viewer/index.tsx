import { Match, Switch, createEffect, createSignal } from "solid-js";
import type { WorkspaceTextFileSnapshot } from "~/server/workspace-file-reader";
import { readChannelWorkspaceTextFile } from "~/server/workspace-file-actions";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatSize(sizeBytes: number) {
  return `${sizeBytes.toLocaleString()} bytes`;
}

type WorkspaceFileViewerProps = {
  channelId: string;
  filePath: string;
  onClose: () => void;
};

export function WorkspaceFileViewer(props: WorkspaceFileViewerProps) {
  const [file, setFile] = createSignal<WorkspaceTextFileSnapshot | null>(null);
  const [error, setError] = createSignal<unknown>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  let requestVersion = 0;

  createEffect(() => {
    const channelId = props.channelId;
    const filePath = props.filePath;
    const currentRequestVersion = ++requestVersion;

    setIsLoading(true);
    setError(null);
    setFile(null);

    void readChannelWorkspaceTextFile(channelId, filePath)
      .then((nextFile) => {
        if (currentRequestVersion !== requestVersion) {
          return;
        }

        setFile(nextFile);
      })
      .catch((nextError) => {
        if (currentRequestVersion !== requestVersion) {
          return;
        }

        setError(nextError);
      })
      .finally(() => {
        if (currentRequestVersion !== requestVersion) {
          return;
        }

        setIsLoading(false);
      });
  });

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
        <Match when={isLoading()}>
          <div class="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
            Opening file…
          </div>
        </Match>
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
          <Match when={error()}>
            <div class="space-y-1 p-4 text-sm text-red-700">
              <div class="font-medium">Unable to open file.</div>
              <div class="text-xs text-red-600">{getErrorMessage(error())}</div>
            </div>
          </Match>

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
