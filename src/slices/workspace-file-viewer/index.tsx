import { ErrorBoundary, Suspense } from "solid-js";
import { createAsync, type AccessorWithLatest } from "@solidjs/router";
import type { WorkspaceTextFileSnapshot } from "~/server/workspace-file-reader";
import { readChannelWorkspaceTextFile } from "~/server/workspace-file-actions";

function formatSize(sizeBytes: number) {
  return `${sizeBytes.toLocaleString()} bytes`;
}

function formatFileError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function WorkspaceFileBody(props: { file: WorkspaceTextFileSnapshot }) {
  return (
    <>
      <div class="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
        {formatSize(props.file.sizeBytes)}
        <span class="mx-2 text-gray-300">•</span>
        {props.file.modifiedAt}
      </div>

      <div class="flex-1 overflow-auto bg-gray-50">
        <pre class="min-h-full overflow-auto p-4 font-mono text-sm leading-6 whitespace-pre text-gray-900">
          {props.file.content}
        </pre>
      </div>
    </>
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
      <div class="flex items-start justify-between gap-4 border-b border-gray-200 p-4">
        <div class="min-w-0">
          <h2 class="truncate text-lg font-semibold text-gray-900">
            {file.latest?.name ?? props.filePath.split("/").at(-1) ?? "File"}
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

      <ErrorBoundary
        fallback={(error) => (
          <div class="flex-1 overflow-auto bg-gray-50 p-4 text-sm text-red-700">
            <p class="font-medium text-red-900">Unable to open file.</p>
            <p class="mt-1">{formatFileError(error)}</p>
          </div>
        )}
      >
        <Suspense
          fallback={
            <div class="flex-1 overflow-auto bg-gray-50 p-4 text-sm text-gray-500">
              Opening file…
            </div>
          }
        >
          <WorkspaceFileBody file={file()!} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
