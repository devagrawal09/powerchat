import { For, Show } from "solid-js";
import { useWatchedQuery } from "~/lib/useWatchedQuery";

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
  // Documents in channel
  const documents = useWatchedQuery<DocumentRow>(
    () =>
      `SELECT id, title, description 
       FROM documents 
       WHERE channel_id = ? 
       ORDER BY created_at DESC`,
    () => [props.channelId]
  );

  return (
    <>
      <div class="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">
        Documents
      </div>
      <Show when={!documents.loading}>
        <For each={documents.data}>
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
