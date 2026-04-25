import { and, asc, eq, sql } from "drizzle-orm";
import {
  agents,
  clientDb,
  liveQuery,
  messages as messagesTable,
  users,
} from "~/db/client";
import { For, Show, createMemo, createEffect } from "solid-js";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";
import { RenderMarkdown } from "~/components/Markdown";
import { getUsername } from "~/lib/getUsername";

type MessageRow = {
  id: string;
  channel_id: string;
  author_type: string;
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
  const authorName = sql<string>`
    case
      when ${messagesTable.authorType} = 'system' then 'System'
      when ${messagesTable.authorType} = 'user' then ${users.id}
      when ${messagesTable.authorType} = 'agent' then ${agents.name}
      else ${messagesTable.authorId}
    end
  `;

  const messages = useQuery(
    () =>
      liveQuery(
        clientDb
          .select({
            id: messagesTable.id,
            channel_id: messagesTable.channelId,
            author_type: messagesTable.authorType,
            author_id: messagesTable.authorId,
            content: messagesTable.content,
            created_at: messagesTable.createdAt,
            author_name: authorName,
          })
          .from(messagesTable)
          .leftJoin(
            users,
            and(
              eq(messagesTable.authorType, "user"),
              eq(users.id, messagesTable.authorId),
            ),
          )
          .leftJoin(
            agents,
            and(
              eq(messagesTable.authorType, "agent"),
              eq(agents.id, messagesTable.authorId),
            ),
          )
          .where(eq(messagesTable.channelId, props.channelId))
          .orderBy(asc(messagesTable.createdAt), asc(messagesTable.id)),
      ),
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
    await clientDb.delete(messagesTable).where(eq(messagesTable.id, messageId));
  };

  return (
    <div
      ref={scrollContainer}
      class="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50"
    >
      <Show
        when={messages().data.length > 0}
        fallback={
          <div class="flex-1 flex items-center justify-center">
            <div class="text-center max-w-xs">
              <svg
                class="mx-auto mb-3 text-gray-300"
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M10 30V26H7C5.34 26 4 24.66 4 23V9C4 7.34 5.34 6 7 6H33C34.66 6 36 7.34 36 9V23C36 24.66 34.66 26 33 26H19L10 30Z" />
                <line x1="12" y1="13" x2="28" y2="13" />
                <line x1="12" y1="18" x2="22" y2="18" />
              </svg>
              <p class="text-sm font-medium text-gray-500">No messages yet</p>
              <p class="text-xs text-gray-400 mt-1">Be the first to say something!</p>
            </div>
          </div>
        }
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
