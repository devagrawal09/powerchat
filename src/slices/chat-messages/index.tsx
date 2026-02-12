import { For, Show, createMemo, createEffect } from "solid-js";
import { usePowerSync } from "~/lib/powersync-solid";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";
import { RenderMarkdown } from "~/components/Markdown";
import { getUsername } from "~/lib/getUsername";

type MessageRow = {
  id: string;
  channel_id: string;
  author_type: "user" | "agent" | "system";
  author_id: string;
  content: string;
  created_at: string;
  author_name: string;
};

type ChatMessagesProps = {
  channelId: string;
};

export function ChatMessages(props: ChatMessagesProps) {
  console.log(`ChatMessages props: ${JSON.stringify(props)}`);
  let scrollContainer: HTMLDivElement | undefined;
  const powersync = usePowerSync();

  // Query messages with author names via JOIN
  const messages = useQuery<MessageRow>(
    () =>
      `SELECT m.*,
              CASE
                WHEN m.author_type = 'system' THEN 'System'
                WHEN m.author_type = 'user' THEN u.id
                WHEN m.author_type = 'agent' THEN a.name
                ELSE m.author_id
              END AS author_name
       FROM messages m
       LEFT JOIN users u ON m.author_type = 'user' AND u.id = m.author_id
       LEFT JOIN agents a ON m.author_type = 'agent' AND a.id = m.author_id
       WHERE m.channel_id = ?
       ORDER BY m.created_at ASC, m.id ASC`,
    () => [props.channelId],
  );

  // Helper to get author name
  const getAuthorName = (message: MessageRow): string => {
    return message.author_name || message.author_id;
  };

  createEffect(() => {
    const m = JSON.stringify(messages().data, null, 2);
    console.log("messages", m);
  });

  const currentUsername = createMemo(() => getUsername());

  // Track message count to detect new messages
  const messageCount = createMemo(() => messages().data.length);
  const lastMessageId = createMemo(() =>
    messages().data.length > 0
      ? messages().data[messages().data.length - 1]?.id
      : null,
  );

  // Scroll to bottom when channel changes or new messages arrive
  createEffect(() => {
    props.channelId; // Track channelId changes
    messageCount(); // Track message count changes
    lastMessageId(); // Track last message ID changes
    if (!messages().isLoading && scrollContainer) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
      }, 0);
    }
  });

  // Check if message mentions current user
  const isMentioned = (content: string) => {
    const username = currentUsername();
    if (!username) return false;
    const mentions = Array.from(content.matchAll(/@([a-z0-9_]+)/gi)).map((m) =>
      m[1].toLowerCase().trim(),
    );
    const normalizedUsername = username.toLowerCase().trim();
    return mentions.includes(normalizedUsername);
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId: string) => {
    if (!powersync) {
      console.error("[delete message] PowerSync not configured");
      return;
    }

    await powersync.writeTransaction(async (tx) => {
      await tx.execute("DELETE FROM messages WHERE id = ?", [messageId]);
    });
  };

  return (
    <div
      ref={scrollContainer}
      class="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50"
    >
      <Show
        when={messages().data.length > 0}
        fallback={<div class="text-sm text-gray-500">No messages yet</div>}
      >
        <For each={messages().data}>
          {(message) => {
            const authorName = createMemo(() => getAuthorName(message));
            const mentioned = createMemo(() => isMentioned(message.content));

            return (
              <div
                class={`group flex gap-3 p-2 rounded-lg ${
                  mentioned() ? "bg-blue-50 border-l-4 border-blue-400" : ""
                }`}
              >
                <div class="shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700">
                  {authorName()?.[0]?.toUpperCase() || "?"}
                </div>
                <div class="flex-1">
                  <div class="flex items-baseline gap-2 justify-between">
                    <div class="flex items-baseline gap-2">
                      <span class="font-semibold text-sm text-gray-900">
                        {authorName()}
                      </span>
                      <span class="text-xs text-gray-500">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      class="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDeleteMessage(message.id);
                      }}
                      aria-label="Delete message"
                    >
                      ×
                    </button>
                  </div>
                  <div class="text-sm mt-1 text-gray-900">
                    <RenderMarkdown>{message.content}</RenderMarkdown>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}
