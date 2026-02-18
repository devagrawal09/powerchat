import { Show } from "solid-js";
import { eq, useLiveQuery } from "@tanstack/solid-db";
import { RenderMarkdown } from "~/components/Markdown";
import { documentsCollection } from "~/lib/tanstack-db";

type DocumentRow = {
  id: string;
  title: string;
  description: string;
  content: string;
};

type DocumentViewerProps = {
  documentId: string;
  onClose: () => void;
};

export function DocumentViewer(props: DocumentViewerProps) {
  const document = useLiveQuery((q) =>
    q
      .from({ doc: documentsCollection })
      .where(({ doc }) => eq(doc.id, props.documentId))
      .select(({ doc }) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        content: doc.content,
      })),
  );

  return (
    <div class="flex-1 flex flex-col h-full">
      {/* Header with title and close button */}
      <div class="border-b border-gray-200 bg-white p-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">
          {document()[0]?.title || "Document"}
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
        <Show when={document().length > 0}>
          <div class="max-w-4xl mx-auto">
            {/* Description */}
            <div class="mb-6">
              <p class="text-sm text-gray-600">
                {document()[0].description}
              </p>
            </div>

            {/* Content */}
            <div class="prose prose-sm max-w-none text-gray-900">
              <RenderMarkdown>{document()[0].content}</RenderMarkdown>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
