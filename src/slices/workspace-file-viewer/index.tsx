import { ErrorBoundary } from "solid-js";
import { createAsync } from "@solidjs/router";
import type { WorkspaceTextFileSnapshot } from "~/server/workspace-file-reader";
import { readChannelWorkspaceTextFile } from "~/server/workspace-file-actions";

function formatFileError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function WorkspaceFileBody(props: { file: WorkspaceTextFileSnapshot }) {
  return (
    <div class="flex-1 overflow-auto bg-gray-50">
      <pre class="min-h-full overflow-auto p-4 font-mono text-sm leading-6 whitespace-pre text-gray-900">
        {props.file.content}
      </pre>
    </div>
  );
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
      <ErrorBoundary
        fallback={(error) => {
          return (
            <div class="flex-1 overflow-auto bg-gray-50 p-4 text-sm text-red-700">
              <p class="font-medium text-red-900">Unable to open file.</p>
              <p class="mt-1">{formatFileError(error)}</p>
            </div>
          );
        }}
      >
        <div class="flex items-start justify-between gap-4 border-b border-gray-200 pb-2.5 pb-2.25 px-2">
          <div class="">
            <h2 class="truncate text-md font-semibold text-gray-900">
              {file.latest?.name ?? props.filePath.split("/").at(-1) ?? "File"}
            </h2>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
          >
            &times;
          </button>
        </div>
        {file() && <WorkspaceFileBody file={file()!} />}
      </ErrorBoundary>
    </div>
  );
}
