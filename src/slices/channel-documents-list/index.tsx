import { For, Show } from "solid-js";
import { eq, useLiveQuery } from "@tanstack/solid-db";
import { documentsCollection } from "~/lib/tanstack-db";

type DocumentRow = {
  id: string;
  title: string;
  description: string;
};

type ChannelDocumentsListProps = {
  channelId: string;
  onDocumentClick: (documentId: string) => void;
};

export function ChannelDocumentsList(props: ChannelDocumentsListProps) {
  const documents = useLiveQuery((q) =>
    q
      .from({ document: documentsCollection })
      .where(({ document }) => eq(document.channel_id, props.channelId))
      .orderBy(({ document }) => document.created_at, "desc")
      .select(({ document }) => ({
        id: document.id,
        title: document.title,
        description: document.description,
      })),
  );

  return (
    <>
      <div class="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">
        Documents
      </div>
      <Show when={!documents.isLoading && documents.isReady}>
        <For each={documents()}>
          {(doc) => (
            <div
              onClick={() => props.onDocumentClick(doc.id)}
              class="text-sm text-gray-900 py-1 cursor-pointer hover:text-blue-600 hover:underline"
            >
              {doc.title}
            </div>
          )}
        </For>
      </Show>
    </>
  );
}
