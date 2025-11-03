import {
  createMemo,
  createSignal,
  For,
  Show,
  Suspense,
  onCleanup,
} from "solid-js";
import { useParams } from "@solidjs/router";
import { writeTransaction } from "~/lib/powersync";
import { streamAgent } from "~/server/agent";
import { useWatchedQuery } from "~/lib/useWatchedQuery";
import { getUserId } from "~/lib/getUserId";

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

type MemberRow = {
  member_type: "user" | "agent";
  member_id: string;
  name: string | null;
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

  // Watch channel members (users and agents)
  const members = useWatchedQuery<MemberRow>(
    () =>
      `SELECT cm.member_type, cm.member_id,
              COALESCE(u.display_name, a.name) AS name
       FROM channel_members cm
       LEFT JOIN users u ON cm.member_type = 'user' AND u.id = cm.member_id
       LEFT JOIN agents a ON cm.member_type = 'agent' AND a.id = cm.member_id
       WHERE cm.channel_id = ?
       ORDER BY cm.member_type, name`,
    () => [channelId()]
  );

  const [content, setContent] = createSignal("");
  const [sending, setSending] = createSignal(false);

  // --- Mentions UI state ---
  const [mentionOpen, setMentionOpen] = createSignal(false);
  const [mentionQuery, setMentionQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);

  // Simple fuzzy match: case-insensitive subsequence search
  function fuzzyMatch(text: string, query: string): boolean {
    if (!query) return true;
    let ti = 0;
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    for (let i = 0; i < t.length && ti < q.length; i++) {
      if (t[i] === q[ti]) ti++;
    }
    return ti === q.length;
  }

  const mentionOptions = createMemo(() => {
    const q = mentionQuery();
    const list = (members.data || []).map((m) => ({
      id: m.member_id,
      type: m.member_type,
      name:
        m.name ||
        (m.member_id === "00000000-0000-0000-0000-000000000001"
          ? "assistant"
          : "user"),
    }));
    const filtered = list.filter((o) => fuzzyMatch(o.name, q));
    // Keep deterministic order: agents after users while filtering preserves
    return filtered;
  });

  function getCaretMention(
    text: string
  ): { start: number; query: string } | null {
    const pos = text.length; // input caret at end; for simplicity we use end
    const upto = text.slice(0, pos);
    const at = upto.lastIndexOf("@");
    if (at === -1) return null;
    // Stop if contains space or newline after '@'
    const fragment = upto.slice(at + 1);
    if (/\s/.test(fragment)) return null;
    return { start: at, query: fragment };
  }

  function insertMention(name: string) {
    const text = content();
    const found = getCaretMention(text);
    if (!found) return;
    const before = text.slice(0, found.start);
    const after = text.slice(found.start + 1 + found.query.length);
    const next = `${before}@${name} ${after}`;
    setContent(next);
    setMentionOpen(false);
  }

  // Auto-scroll on new messages (watch keeps messages updated)

  const handleSend = async () => {
    const text = content().trim();
    if (!text) return;

    setSending(true);
    try {
      // Client-side write to local PowerSync DB
      const messageId = crypto.randomUUID();
      const userId = getUserId();
      console.log(
        "[send] userId",
        userId,
        "messageId",
        messageId,
        "text",
        text
      );

      await writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO messages (id, channel_id, author_type, author_id, content, created_at)
           VALUES (?, ?, 'user', ?, ?, datetime('now'))`,
          [messageId, channelId(), userId, text]
        );
        console.log("[send] message inserted");
      });

      // Detect @mentions (case-insensitive)
      const mentionedNames = Array.from(text.matchAll(/@([a-z0-9_]+)/gi)).map(
        (m) => m[1].toLowerCase()
      );
      console.log("[send] mentioned names detected", mentionedNames);

      // Resolve agent members from members watcher (robust to sync lag)
      const agentMembers = (members.data || [])
        .filter((m) => m.member_type === "agent")
        .map((m) => ({
          id: m.member_id,
          name: (
            m.name ||
            (m.member_id === "00000000-0000-0000-0000-000000000001"
              ? "assistant"
              : "agent")
          ).toLowerCase(),
        }));
      console.log("[send] agents in channel", agentMembers);
      const mentionedAgentIds = agentMembers
        .filter((a) => mentionedNames.includes(a.name))
        .map((a) => a.id);
      console.log("[send] resolved mentionedAgentIds", mentionedAgentIds);

      if (mentionedAgentIds.length > 0) {
        console.log("[send] triggering agent stream with", mentionedAgentIds);

        // Build minimal recent history for the agent
        const history = (messages.data || []).slice(-30).map((m) => ({
          role: m.author_type === "user" ? "user" : "assistant",
          content: m.content,
        }));

        const agentId = mentionedAgentIds[0];

        // Insert a placeholder agent message that we'll progressively update
        const agentMessageId = crypto.randomUUID();
        await writeTransaction(async (tx) => {
          await tx.execute(
            `INSERT INTO messages (id, channel_id, author_type, author_id, content, created_at)
             VALUES (?, ?, 'agent', ?, ?, datetime('now'))`,
            [agentMessageId, channelId(), agentId, ""]
          );
        });

        // Stream from server and update the placeholder content as deltas arrive
        const stream = await streamAgent(`
          Channel: ${channelId()}
          ${history.map((h) => `${h.role}: ${h.content}`).join("\n")}
          User: ${text}
        `);

        let acc = "";
        for await (const delta of stream) {
          console.log("[send] agent stream delta", delta);
          if (!delta) continue;
          acc += delta;
          await writeTransaction(async (tx) => {
            await tx.execute(`UPDATE messages SET content = ? WHERE id = ?`, [
              acc,
              agentMessageId,
            ]);
          });
        }

        // Record the mention relationship
        await writeTransaction(async (tx) => {
          await tx.execute(
            `INSERT INTO message_mentions (id, message_id, agent_id) VALUES (?, ?, ?)`,
            [crypto.randomUUID(), messageId, agentId]
          );
        });

        console.log("[send] agent stream complete");
      }

      setContent("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div class="flex-1 flex h-full">
      <div class="flex-1 flex flex-col">
        {/* Header */}
        <div class="border-b border-gray-200 p-4 bg-white">
          <Suspense
            fallback={
              <div class="text-lg font-semibold text-gray-900">Loading...</div>
            }
          >
            <Show when={!channel.loading}>
              <h2 class="text-lg font-semibold text-gray-900">
                # {channel.data?.[0]?.name}
              </h2>
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
                      <div class="text-sm mt-1 text-gray-900">
                        {message.content}
                      </div>
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
            <div class="relative flex-1">
              <input
                type="text"
                value={content()}
                onInput={(e) => {
                  const val = e.currentTarget.value;
                  setContent(val);
                  const found = getCaretMention(val);
                  if (found) {
                    setMentionOpen(true);
                    setMentionQuery(found.query);
                    setActiveIndex(0);
                  } else {
                    setMentionOpen(false);
                    setMentionQuery("");
                  }
                }}
                onKeyDown={(e) => {
                  if (!mentionOpen()) return;
                  const opts = mentionOptions();
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => (i + 1) % Math.max(opts.length, 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex(
                      (i) =>
                        (i - 1 + Math.max(opts.length, 1)) %
                        Math.max(opts.length, 1)
                    );
                  } else if (e.key === "Enter") {
                    if (opts.length > 0) {
                      e.preventDefault();
                      insertMention(opts[Math.max(0, activeIndex())].name);
                    }
                  } else if (e.key === "Escape") {
                    setMentionOpen(false);
                  }
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Message #${
                  channel.data?.[0]?.name || "channel"
                }...`}
                class="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-400 bg-white"
                disabled={sending()}
              />
              {/** Mentions drop-up above the input */}
              <Show when={mentionOpen() && mentionOptions().length > 0}>
                <div class="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-auto bg-white border border-gray-200 rounded shadow z-50">
                  <For each={mentionOptions()}>
                    {(opt, idx) => (
                      <button
                        type="button"
                        class={`${
                          idx() === activeIndex() ? "bg-blue-50" : "bg-white"
                        } w-full text-left px-3 py-2`}
                        onMouseEnter={() => setActiveIndex(idx())}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(opt.name);
                        }}
                      >
                        <span class="text-xs uppercase text-gray-500 mr-2">
                          {opt.type}
                        </span>
                        <span class="text-gray-900">@{opt.name}</span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
            <button
              onClick={handleSend}
              disabled={sending() || !content().trim()}
              class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending() ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
        {/* Mentions drop-up moved inside input container */}
      </div>

      {/* Right sidebar - Members */}
      <aside class="w-64 border-l border-gray-200 bg-white p-4 overflow-y-auto">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Members</h3>

        <div class="text-xs font-semibold text-gray-500 uppercase mb-2">
          Users
        </div>
        <Show when={!members.loading}>
          <For each={members.data?.filter((m) => m.member_type === "user")}>
            {(member) => (
              <div class="text-sm text-gray-900 py-1">
                {member.name || "Anonymous"}
              </div>
            )}
          </For>
        </Show>

        <div class="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">
          Agents
        </div>
        <Show when={!members.loading}>
          <For each={members.data?.filter((m) => m.member_type === "agent")}>
            {(member) => (
              <div class="text-sm text-gray-900 py-1">
                @
                {member.name ||
                  (member.member_id === "00000000-0000-0000-0000-000000000001"
                    ? "assistant"
                    : "Agent")}
              </div>
            )}
          </For>
        </Show>
      </aside>
    </div>
  );
}
