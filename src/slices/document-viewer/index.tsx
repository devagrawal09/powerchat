import { Show, createResource, createEffect, on } from "solid-js";
import { RenderMarkdown } from "~/components/Markdown";
import { readWorkspaceFile } from "~/server/workspace-files";

type DocumentViewerProps = {
  channelId: string;
  filePath: string;
  onClose: () => void;
};

export function DocumentViewer(props: DocumentViewerProps) {
  const [file, { refetch }] = createResource(
    () => ({ channelId: props.channelId, filePath: props.filePath }),
    (params) => readWorkspaceFile(params.channelId, params.filePath),
  );

  // Refetch when channelId or filePath changes
  createEffect(on(() => [props.channelId, props.filePath], () => refetch()));

  return (
    <div class="flex-1 flex flex-col h-full">
      {/* Header with title and close button */}
      <div class="border-b border-gray-200 bg-white p-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">
          {file()?.name || "Document"}
        </h2>
        <button
          onClick={props.onClose}
          class="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
        >
          Close
        </button>
      </div>

      {/* Document content */}
      <div class="flex-1 overflow-y-auto p-4 bg-gray-50">
        <Show when={file.loading}>
          <div class="flex items-center justify-center py-8">
            <p class="text-sm text-gray-500">Loading file...</p>
          </div>
        </Show>
        <Show when={file.error}>
          <div class="flex items-center justify-center py-8">
            <p class="text-sm text-red-600">
              Error loading file: {file.error?.message || "Unknown error"}
            </p>
          </div>
        </Show>
        <Show when={!file.loading && !file.error && file()}>
          <div class="max-w-4xl mx-auto">
            {/* File path */}
            <div class="mb-4">
              <p class="text-xs text-gray-400 font-mono">{file()!.path}</p>
            </div>

            {/* Content */}
            <div class="prose prose-sm max-w-none text-gray-900">
              <RenderMarkdown>{file()!.content}</RenderMarkdown>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
