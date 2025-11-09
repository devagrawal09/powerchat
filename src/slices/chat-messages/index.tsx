import { For, Show } from "solid-js";
import { useWatchedQuery } from "~/lib/useWatchedQuery";
import { RenderMarkdown } from "~/components/Markdown";

type MessageRow = {
  id: string;
  channel_id: string;
  author_type: "user" | "agent" | "system";
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string | null;
};

type ChatMessagesProps = {
  channelId: string;
};

export function ChatMessages(props: ChatMessagesProps) {
  // Query messages with author name resolution
  // Note: This author name resolution logic (CASE statement) is duplicated in chat-input/index.tsx.
  // This is acceptable per VSA principles (slice independence). Each slice maintains its own logic.
  // If duplicated a third time, consider extracting to shared utility lib/getAuthorName.ts
  const messages = useWatchedQuery<MessageRow>(
    () =>
      `SELECT m.*, 
        CASE 
          WHEN m.author_type = 'user' THEN u.id
          WHEN m.author_type = 'agent' THEN COALESCE(a.name, 
            CASE 
              WHEN m.author_id = '00000000-0000-0000-0000-000000000001' THEN 'assistant'
              ELSE 'Agent'
            END)
          WHEN m.author_type = 'system' THEN 'System'
        END as author_name
       FROM messages m
       LEFT JOIN users u ON m.author_type = 'user' AND m.author_id = u.id
       LEFT JOIN agents a ON m.author_type = 'agent' AND m.author_id = a.id
       WHERE m.channel_id = ?
       ORDER BY m.created_at ASC, m.id ASC`,
    () => [props.channelId]
  );

  return (
    <div class="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
      <Show
        when={!messages.loading}
        fallback={<div class="text-sm text-gray-500">Loading messages...</div>}
      >
        <Show
          when={messages.data.length > 0}
          fallback={<div class="text-sm text-gray-500">No messages yet</div>}
        >
          <For each={messages.data}>
            {(message) => (
              <div class="flex gap-3">
                <div class="shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700">
                  {message.author_name?.[0]?.toUpperCase() || "?"}
                </div>
                <div class="flex-1">
                  <div class="flex items-baseline gap-2">
                    <span class="font-semibold text-sm text-gray-900">
                      {message.author_name || "Unknown"}
                    </span>
                    <span class="text-xs text-gray-500">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div class="text-sm mt-1 text-gray-900">
                    <RenderMarkdown>{message.content}</RenderMarkdown>
                  </div>
                </div>
              </div>
            )}
          </For>
        </Show>
      </Show>
    </div>
  );
}
