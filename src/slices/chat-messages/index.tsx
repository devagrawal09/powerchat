import { For, Show, createMemo, createEffect } from "solid-js";
import { useWatchedQuery } from "~/lib/useWatchedQuery";
import { RenderMarkdown } from "~/components/Markdown";
import { getUsername } from "~/lib/getUsername";

type MessageRow = {
  id: string;
  channel_id: string;
  author_type: "user" | "agent" | "system";
  author_id: string;
  content: string;
  created_at: string;
};

type MemberRow = {
  member_type: "user" | "agent";
  member_id: string;
  name: string | null;
};

type ChatMessagesProps = {
  channelId: string;
};

export function ChatMessages(props: ChatMessagesProps) {
  let scrollContainer: HTMLDivElement | undefined;

  // Query messages without JOINs - enables trigger-based diffs later
  const messages = useWatchedQuery<MessageRow>(
    () =>
      `SELECT * 
       FROM messages 
       WHERE channel_id = ?
       ORDER BY created_at ASC, id ASC`,
    () => [props.channelId]
  );

  // Query channel members separately for author name lookup
  const members = useWatchedQuery<MemberRow>(
    () =>
      `SELECT cm.member_type, cm.member_id,
              CASE 
                WHEN cm.member_type = 'user' THEN COALESCE(u.id, cm.member_id)
                WHEN cm.member_type = 'agent' THEN COALESCE(a.name, 'Agent')
                ELSE cm.member_id
              END AS name
       FROM channel_members cm
       LEFT JOIN users u ON cm.member_type = 'user' AND u.id = cm.member_id
       LEFT JOIN agents a ON cm.member_type = 'agent' AND a.id = cm.member_id
       WHERE cm.channel_id = ?`,
    () => [props.channelId]
  );

  // Create lookup map: (author_type, author_id) -> name
  const authorNameMap = createMemo(() => {
    const map = new Map<string, string>();
    (members.data || []).forEach((member) => {
      const key = `${member.member_type}:${member.member_id}`;
      map.set(key, member.name || member.member_id);
    });
    return map;
  });

  // Helper to get author name
  const getAuthorName = (message: MessageRow): string => {
    if (message.author_type === "system") {
      return "System";
    }
    const key = `${message.author_type}:${message.author_id}`;
    return authorNameMap().get(key) || message.author_id;
  };

  createEffect(() => {
    const m = JSON.stringify(messages.data, null, 2);
    console.log("messages", m);
  });

  const currentUsername = createMemo(() => getUsername());

  // Track message count to detect new messages
  const messageCount = createMemo(() => messages.data.length);
  const lastMessageId = createMemo(() =>
    messages.data.length > 0
      ? messages.data[messages.data.length - 1]?.id
      : null
  );

  // Scroll to bottom when channel changes or new messages arrive
  createEffect(() => {
    props.channelId; // Track channelId changes
    messageCount(); // Track message count changes
    lastMessageId(); // Track last message ID changes
    if (!messages.loading && scrollContainer) {
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
      m[1].toLowerCase().trim()
    );
    const normalizedUsername = username.toLowerCase().trim();
    return mentions.includes(normalizedUsername);
  };

  return (
    <div
      ref={scrollContainer}
      class="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50"
    >
      <Show
        when={!messages.loading}
        fallback={<div class="text-sm text-gray-500">Loading messages...</div>}
      >
        <Show
          when={messages.data.length > 0}
          fallback={<div class="text-sm text-gray-500">No messages yet</div>}
        >
          <For each={messages.data}>
            {(message) => {
              const authorName = createMemo(() => getAuthorName(message));
              const mentioned = createMemo(() => isMentioned(message.content));
              return (
                <div
                  class={`flex gap-3 p-2 rounded-lg ${
                    mentioned() ? "bg-blue-50 border-l-4 border-blue-400" : ""
                  }`}
                >
                  <div class="shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700">
                    {authorName()?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div class="flex-1">
                    <div class="flex items-baseline gap-2">
                      <span class="font-semibold text-sm text-gray-900">
                        {authorName()}
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
              );
            }}
          </For>
        </Show>
      </Show>
    </div>
  );
}
