import { createSignal, createMemo, For, Show } from "solid-js";
import { writeTransaction } from "~/lib/powersync";
import { processAgentResponse } from "~/server/agent";
import { getUsername } from "~/lib/getUsername";
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

  const messages = useWatchedQuery<MessageRow>(
    () =>
      `SELECT id, author_type, content, created_at FROM messages 
       WHERE channel_id = ? 
       ORDER BY created_at ASC, id ASC`,
    () => [props.channelId]
  );

  const members = useWatchedQuery<MemberRow>(
    () =>
      `SELECT cm.member_type, cm.member_id,
              COALESCE(u.id, a.name) AS name
       FROM channel_members cm
       LEFT JOIN users u ON cm.member_type = 'user' AND u.id = cm.member_id
       LEFT JOIN agents a ON cm.member_type = 'agent' AND a.id = cm.member_id
       WHERE cm.channel_id = ?
       ORDER BY cm.member_type, name`,
    () => [props.channelId]
  );

  // Filtered mention options
  const mentionOptions = createMemo(() => {
    const q = mentionQuery().toLowerCase();
    const list = (members.data || []).map((m) => ({
      type: m.member_type,
      id: m.member_id,
      name:
        m.name ||
        (m.member_id === "00000000-0000-0000-0000-000000000001"
          ? "assistant"
          : "user"),
    }));
    const filtered = list.filter((o) => fuzzyMatch(o.name, q));
    return filtered;
  });

  // Fuzzy search utility
  function fuzzyMatch(text: string, query: string): boolean {
    if (!query) return true;
    text = text.toLowerCase();
    let i = 0,
      j = 0;
    while (i < text.length && j < query.length) {
      if (text[i] === query[j]) {
        j++;
      }
      i++;
    }
    return j === query.length;
  }

  // Get current mention fragment at caret
  function getCaretMention(
    text: string
  ): { start: number; query: string } | null {
    const pos = text.length;
    const upto = text.slice(0, pos);
    const match = upto.match(/@([a-z0-9_]*)$/i);
    if (match && match[1] !== undefined) {
      return { start: match.index!, query: match[1] };
    }
    return null;
  }

  // Insert selected mention into content
  function insertMention(name: string) {
    const currentContent = content();
    const mention = getCaretMention(currentContent);
    if (mention) {
      const newContent =
        currentContent.slice(0, mention.start) +
        `@${name} ` +
        currentContent.slice(mention.start + mention.query.length + 1);
      setContent(newContent);
      setMentionOpen(false);
    }
  }

  const handleSend = async () => {
    const text = content().trim();
    if (!text) return;

    try {
      const messageId = crypto.randomUUID();
      const username = getUsername();
      const userMessageCreatedAt = new Date().toISOString();

      if (!username) {
        console.error("[send] No username found");
        return;
      }

      console.log(
        "[send] username",
        username,
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
          [messageId, props.channelId, username, text, userMessageCreatedAt]
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
        const agentId = mentionedAgentIds[0];
        const agentMessageId = crypto.randomUUID();
        const agentMessageCreatedAt = new Date().toISOString();

        // Insert placeholder "Thinking..." message
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

        // Call server function to process agent response
        // Server will query channel history and write directly to Neon, PowerSync will sync it back
        console.log("[send] Calling processAgentResponse");
        await processAgentResponse(
          props.channelId,
          agentId,
          agentMessageId,
          text
        );
        console.log("[send] Agent processing complete");
      }

      setContent("");
      setMentionOpen(false);
    } catch (error: unknown) {
      console.error("[send] error", error);
      // Error will be handled by the server function
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
                  insertMention(opts[Math.max(0, activeIndex())].name);
                }
              } else if (e.key === "Escape") {
                setMentionOpen(false);
              }
            }}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !mentionOpen()) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message #${channel.data?.[0]?.name || "channel"}...`}
            class="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-400 bg-white"
          />
          {/* Mentions drop-up */}
          <Show when={mentionOpen() && mentionOptions().length > 0}>
            <div class="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-auto bg-white border border-gray-200 rounded shadow z-50">
              <For each={mentionOptions()}>
                {(opt, idx) => (
                  <button
                    type="button"
                    class={`${
                      idx() === activeIndex() ? "bg-blue-50" : "bg-white"
                    } w-full text-left px-3 py-2`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(opt.name);
                    }}
                    onMouseEnter={() => setActiveIndex(idx())}
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
