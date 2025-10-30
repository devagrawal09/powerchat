import {
  Component,
  createResource,
  createSignal,
  For,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { useParams } from "@solidjs/router";
import { getPowerSync, writeTransaction } from "~/lib/powersync";
import { triggerAgent } from "~/server/agent";

export default function ChannelPage() {
  const params = useParams();
  const channelId = () => params.id;
  let messagesEndRef: HTMLDivElement | undefined;

  // Query channel details
  const [channel] = createResource(channelId, async (id) => {
    const db = await getPowerSync();
    const result = await db.execute(`SELECT * FROM channels WHERE id = ?`, [
      id,
    ]);
    return result.rows?._array?.[0];
  });

  // Query messages with stable ordering
  const [messages, { refetch }] = createResource(channelId, async (id) => {
    const db = await getPowerSync();
    const result = await db.execute(
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
      [id]
    );
    return result.rows?._array || [];
  });

  // Query agents in channel for autocomplete
  const [agents] = createResource(channelId, async (id) => {
    const db = await getPowerSync();
    const result = await db.execute(
      `SELECT a.* FROM agents a
       JOIN channel_members cm ON cm.member_id = a.id AND cm.member_type = 'agent'
       WHERE cm.channel_id = ?`,
      [id]
    );
    return result.rows?._array || [];
  });

  const [content, setContent] = createSignal("");
  const [sending, setSending] = createSignal(false);

  // Auto-scroll on new messages
  onMount(() => {
    const interval = setInterval(() => {
      refetch();
      messagesEndRef?.scrollIntoView({ behavior: "smooth" });
    }, 2000);
    return () => clearInterval(interval);
  });

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
      const agentsList = agents() || [];
      const mentionedAgents = agentsList.filter((a: any) =>
        mentionedNames.includes(a.name)
      );

      if (mentionedAgents.length > 0) {
        // Trigger agent on server
        await triggerAgent({
          channelId: channelId(),
          messageId,
          content: text,
          agentIds: mentionedAgents.map((a: any) => a.id),
        });
      }

      setContent("");
      refetch();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="border-b border-gray-200 p-4">
        <Suspense
          fallback={<div class="text-lg font-semibold">Loading...</div>}
        >
          <Show when={channel()}>
            <h2 class="text-lg font-semibold"># {channel().name}</h2>
          </Show>
        </Suspense>
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <Suspense
          fallback={
            <div class="text-sm text-gray-500">Loading messages...</div>
          }
        >
          <Show when={messages()}>
            <For each={messages()}>
              {(message: any) => (
                <div class="flex gap-3">
                  <div class="shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold">
                    {message.author_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div class="flex-1">
                    <div class="flex items-baseline gap-2">
                      <span class="font-semibold text-sm">
                        {message.author_name || "Unknown"}
                      </span>
                      <span class="text-xs text-gray-500">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div class="text-sm mt-1">{message.content}</div>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </Suspense>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div class="border-t border-gray-200 p-4">
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
              channel()?.name || "channel"
            }... (use @agent to mention)`}
            class="flex-1 px-4 py-2 border border-gray-300 rounded"
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
        <div class="text-xs text-gray-500 mt-2">
          Available agents:{" "}
          {agents()
            ?.map((a: any) => `@${a.name}`)
            .join(", ") || "none"}
        </div>
      </div>
    </div>
  );
}
