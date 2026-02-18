import { For, Show, createMemo, createEffect } from "solid-js";
import { and, eq, useLiveQuery } from "@tanstack/solid-db";
import { RenderMarkdown } from "~/components/Markdown";
import { getUsername } from "~/lib/getUsername";
import {
  agentsCollection,
  channelMembersCollection,
  ensureTanStackDbReady,
  messagesCollection,
  usersCollection,
} from "~/lib/tanstack-db";

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

  const messages = useLiveQuery((q) =>
    q
      .from({ message: messagesCollection })
      .where(({ message }) => eq(message.channel_id, props.channelId))
      .orderBy(({ message }) => message.created_at, "asc")
      .orderBy(({ message }) => message.id, "asc")
      .select(({ message }) => ({
        id: message.id,
        channel_id: message.channel_id,
        author_type: message.author_type,
        author_id: message.author_id,
        content: message.content,
        created_at: message.created_at,
      })),
  );

  const membersInChannel = useLiveQuery((q) =>
    q
      .from({ member: channelMembersCollection })
      .leftJoin({ user: usersCollection }, ({ member, user }) =>
        eq(user.id, member.member_id),
      )
      .leftJoin({ agent: agentsCollection }, ({ member, agent }) =>
        eq(agent.id, member.member_id),
      )
      .where(({ member }) => eq(member.channel_id, props.channelId))
      .select(({ member, user, agent }) => ({
        member_type: member.member_type,
        member_id: member.member_id,
        user_name: user.id,
        agent_name: agent.name,
      })),
  );

  const members = createMemo<MemberRow[]>(() =>
    membersInChannel().map((member) => ({
      member_type: member.member_type,
      member_id: member.member_id,
      name:
        member.member_type === "user"
          ? (member.user_name ?? member.member_id)
          : (member.agent_name ?? "Agent"),
    })),
  );

  // Create lookup map: (author_type, author_id) -> name
  const authorNameMap = createMemo(() => {
    const map = new Map<string, string>();
    members().forEach((member) => {
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
    const m = JSON.stringify(messages(), null, 2);
    console.log("messages", m);
  });

  const currentUsername = createMemo(() => getUsername());

  // Track message count to detect new messages
  const messageCount = createMemo(() => messages().length);
  const lastMessageId = createMemo(() =>
    messages().length > 0
      ? messages()[messages().length - 1]?.id
      : null,
  );

  // Scroll to bottom when channel changes or new messages arrive
  createEffect(() => {
    props.channelId; // Track channelId changes
    messageCount(); // Track message count changes
    lastMessageId(); // Track last message ID changes
    if (!messages.isLoading && messages.isReady && scrollContainer) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
      }, 0);
    }
  });

  // Check if message mentions current user
  const isMentioned = (content: string | null | undefined) => {
    if (!content) return false;
    const username = currentUsername();
    if (!username) return false;
    const mentions = Array.from(String(content).matchAll(/@([a-z0-9_]+)/gi)).map(
      (m) => m[1].toLowerCase().trim(),
    );
    const normalizedUsername = username.toLowerCase().trim();
    return mentions.includes(normalizedUsername);
  };

  // Check if message belongs to current user
  const isOwnMessage = (message: MessageRow) => {
    const username = currentUsername();
    return (
      message.author_type === "user" &&
      username !== null &&
      message.author_id === username
    );
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId: string) => {
    await ensureTanStackDbReady();
    await messagesCollection.delete(messageId).isPersisted.promise;
  };

  return (
    <div
      ref={scrollContainer}
      class="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50"
    >
      <Show
        when={!messages.isLoading && messages.isReady}
        fallback={<div class="text-sm text-gray-500">Loading messages...</div>}
      >
        <Show
          when={messages().length > 0}
          fallback={<div class="text-sm text-gray-500">No messages yet</div>}
        >
          <For each={messages()}>
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
      </Show>
    </div>
  );
}
