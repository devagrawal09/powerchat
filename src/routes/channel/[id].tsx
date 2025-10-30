import { createSignal, For, Show, Suspense } from "solid-js";
import { useParams } from "@solidjs/router";
import { writeTransaction } from "~/lib/powersync";
import { triggerAgent } from "~/server/agent";
import { useWatchedQuery } from "~/lib/useWatchedQuery";

type ChannelRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  channel_id: string;
  author_type: "user" | "agent" | "system";
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string | null;
};

type AgentRow = {
  id: string;
  name: string;
  model_config: string;
  created_at: string;
};

export default function ChannelPage() {
  const params = useParams();
  const channelId = () => params.id;
  let messagesEndRef: HTMLDivElement | undefined;

  // Watch channel details
  const channel = useWatchedQuery<ChannelRow>(
    () => `SELECT * FROM channels WHERE id = ?`,
    () => [channelId()]
  );

  // Watch messages with stable ordering
  const messages = useWatchedQuery<MessageRow>(
    () =>
      `SELECT m.*, 
        CASE 
          WHEN m.author_type = 'user' THEN u.display_name
          WHEN m.author_type = 'agent' THEN a.name
        END as author_name
       FROM messages m
       LEFT JOIN users u ON m.author_type = 'user' AND m.author_id = u.id
       LEFT JOIN agents a ON m.author_type = 'agent' AND m.author_id = a.id
       WHERE m.channel_id = ?
       ORDER BY m.created_at ASC, m.id ASC`,
    () => [channelId()]
  );

  // Watch agents in channel for autocomplete
  const agents = useWatchedQuery<AgentRow>(
    () =>
      `SELECT a.* FROM agents a
       JOIN channel_members cm ON cm.member_id = a.id AND cm.member_type = 'agent'
       WHERE cm.channel_id = ?`,
    () => [channelId()]
  );

  const [content, setContent] = createSignal("");
  const [sending, setSending] = createSignal(false);

  // Auto-scroll on new messages (watch keeps messages updated)

  const handleSend = async () => {
    const text = content().trim();
    if (!text) return;

    setSending(true);
    try {
      // Client-side write to local PowerSync DB
      const messageId = crypto.randomUUID();
      const userId = localStorage.getItem("pc_uid") || "unknown"; // Fallback for client

      await writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO messages (id, channel_id, author_type, author_id, content, created_at)
           VALUES (?, ?, 'user', ?, ?, datetime('now'))`,
          [messageId, channelId(), userId, text]
        );
      });

      // Detect @mentions
      const mentionMatches = text.matchAll(/@(\w+)/g);
      const mentionedNames = Array.from(mentionMatches).map((m) => m[1]);
      const agentsList = agents.data || [];
      const mentionedAgents = agentsList.filter((a) =>
        mentionedNames.includes(a.name)
      );

      if (mentionedAgents.length > 0) {
        await triggerAgent({
          channelId: channelId(),
          messageId,
          content: text,
          agentIds: mentionedAgents.map((a) => a.id),
        });
      }

      setContent("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="border-b border-gray-200 p-4 bg-white">
        <Suspense
          fallback={<div class="text-lg font-semibold text-gray-900">Loading...</div>}
        >
          <Show when={!channel.loading}>
            <h2 class="text-lg font-semibold text-gray-900"># {channel.data?.[0]?.name}</h2>
          </Show>
        </Suspense>
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        <Suspense
          fallback={
            <div class="text-sm text-gray-500">Loading messages...</div>
          }
        >
          <Show when={!messages.loading}>
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
                    <div class="text-sm mt-1 text-gray-900">{message.content}</div>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </Suspense>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div class="border-t border-gray-200 p-4 bg-white">
        <div class="flex gap-2">
          <input
            type="text"
            value={content()}
            onInput={(e) => setContent(e.currentTarget.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message #${
              channel.data?.[0]?.name || "channel"
            }... (use @agent to mention)`}
            class="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-400 bg-white"
            disabled={sending()}
          />
          <button
            onClick={handleSend}
            disabled={sending() || !content().trim()}
            class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending() ? "Sending..." : "Send"}
          </button>
        </div>
        <div class="text-xs text-gray-600 mt-2">
          Available agents:{" "}
          {agents.data?.map((a) => `@${a.name}`).join(", ") || "none"}
        </div>
      </div>
    </div>
  );
}
