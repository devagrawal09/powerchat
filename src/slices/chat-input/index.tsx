import { createSignal, createMemo, For, Show } from "solid-js";
import { writeTransaction } from "~/lib/powersync";
import { streamAgent } from "~/server/agent";
import { getUserId } from "~/lib/getUserId";
import { useWatchedQuery } from "~/lib/useWatchedQuery";

type MemberRow = {
  member_type: "user" | "agent";
  member_id: string;
  name: string | null;
};

type MessageRow = {
  id: string;
  author_type: "user" | "agent" | "system";
  content: string;
  created_at: string;
};

type ChatInputProps = {
  channelId: string;
};

export function ChatInput(props: ChatInputProps) {
  const [content, setContent] = createSignal("");
  const [mentionOpen, setMentionOpen] = createSignal(false);
  const [mentionQuery, setMentionQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);

  const channel = useWatchedQuery<{ name: string }>(
    () => `SELECT name FROM channels WHERE id = ?`,
    () => [props.channelId]
  );

  // Watch members for autocomplete
  const members = useWatchedQuery<MemberRow>(
    () =>
      `SELECT cm.member_type, cm.member_id,
              COALESCE(u.display_name, a.name) AS name
       FROM channel_members cm
       LEFT JOIN users u ON cm.member_type = 'user' AND u.id = cm.member_id
       LEFT JOIN agents a ON cm.member_type = 'agent' AND a.id = cm.member_id
       WHERE cm.channel_id = ?
       ORDER BY cm.member_type, name`,
    () => [props.channelId]
  );

  // Watch messages for agent context
  const messages = useWatchedQuery<MessageRow>(
    () =>
      `SELECT m.id, m.author_type, m.content, m.created_at
       FROM messages m
       WHERE m.channel_id = ?
       ORDER BY m.created_at ASC, m.id ASC`,
    () => [props.channelId]
  );

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
    return list.filter((o) => fuzzyMatch(o.name, q));
  });

  function getCaretMention(
    text: string
  ): { start: number; query: string } | null {
    const pos = text.length;
    const upto = text.slice(0, pos);
    const at = upto.lastIndexOf("@");
    if (at === -1) return null;
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
    setContent(`${before}@${name} ${after}`);
    setMentionOpen(false);
  }

  const handleSend = async () => {
    const text = content().trim();
    if (!text) return;
    setContent("");

    try {
      const messageId = crypto.randomUUID();
      const userId = getUserId();
      const userMessageCreatedAt = new Date().toISOString();

      console.log(
        "[send] userId",
        userId,
        "messageId",
        messageId,
        "text",
        text
      );

      // Insert user message
      await writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO messages (id, channel_id, author_type, author_id, content, created_at)
           VALUES (?, ?, 'user', ?, ?, ?)`,
          [messageId, props.channelId, userId, text, userMessageCreatedAt]
        );
      });

      // Detect mentions
      const mentionedNames = Array.from(text.matchAll(/@([a-z0-9_]+)/gi)).map(
        (m) => m[1].toLowerCase()
      );

      console.log("[send] mentioned names", mentionedNames);

      // Resolve agent IDs
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

      const mentionedAgentIds = agentMembers
        .filter((a) => mentionedNames.includes(a.name))
        .map((a) => a.id);

      console.log("[send] resolved agent IDs", mentionedAgentIds);

      // Trigger agent if mentioned
      if (mentionedAgentIds.length > 0) {
        const history = (messages.data || []).slice(-30).map((m) => ({
          role: m.author_type === "user" ? "user" : "assistant",
          content: m.content,
        }));

        const agentId = mentionedAgentIds[0];
        const agentMessageId = crypto.randomUUID();
        const agentMessageCreatedAt = new Date().toISOString();

        // Insert placeholder (shows while agent is thinking)
        await writeTransaction(async (tx) => {
          await tx.execute(
            `INSERT INTO messages (id, channel_id, author_type, author_id, content, created_at)
             VALUES (?, ?, 'agent', ?, ?, ?)`,
            [
              agentMessageId,
              props.channelId,
              agentId,
              "Thinking...",
              agentMessageCreatedAt,
            ]
          );
        });

        // Stream agent response
        const stream = await streamAgent(`
          Channel: ${props.channelId}
          ${history.map((h) => `${h.role}: ${h.content}`).join("\n")}
          User: ${text}
        `);

        let acc = "";
        for await (const delta of stream) {
          if (!delta) continue;
          acc += delta;
          await writeTransaction(async (tx) => {
            await tx.execute(`UPDATE messages SET content = ? WHERE id = ?`, [
              acc,
              agentMessageId,
            ]);
          });
        }

        // Record mention
        await writeTransaction(async (tx) => {
          await tx.execute(
            `INSERT INTO message_mentions (id, message_id, agent_id) VALUES (?, ?, ?)`,
            [crypto.randomUUID(), messageId, agentId]
          );
        });

        console.log("[send] agent stream complete");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
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
                  insertMention(opts[activeIndex()].name);
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
            placeholder={`Message #${channel.data?.[0]?.name ?? "channel"}...`}
            class="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-400 bg-white"
          />
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
          disabled={!content().trim()}
          class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
