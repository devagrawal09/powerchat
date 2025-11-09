import { createSignal, createMemo } from "solid-js";
import { writeTransaction } from "~/lib/powersync";
import { processAgentResponse } from "~/server/agent";
import { getUsername } from "~/lib/getUsername";
import { useWatchedQuery } from "~/lib/useWatchedQuery";
import { MentionAutocomplete } from "~/slices/mention-autocomplete";

type MemberRow = {
  member_type: "user" | "agent";
  member_id: string;
  name: string | null;
};

type ChatInputProps = {
  channelId: string;
  channelName?: string;
};

export function ChatInput(props: ChatInputProps) {
  const [content, setContent] = createSignal("");
  const [activeMentionIndex, setActiveMentionIndex] = createSignal(0);

  // Detect mention query from content
  const mentionState = createMemo(() => {
    const text = content();
    const match = text.match(/@([a-z0-9_]*)$/i);
    if (match) {
      return {
        isOpen: true,
        query: match[1],
        cursorPosition: match.index!,
      };
    }
    return { isOpen: false, query: "", cursorPosition: -1 };
  });

  // Query members for agent mention detection and resolution
  // Note: This query is needed for the mutation logic (resolving agent IDs from mentions)
  // The autocomplete UI is handled by the separate MentionAutocomplete slice
  const members = useWatchedQuery<MemberRow>(
    () =>
      `SELECT cm.member_type, cm.member_id,
              CASE 
                WHEN cm.member_type = 'user' THEN COALESCE(u.id, cm.member_id)
                WHEN cm.member_type = 'agent' THEN COALESCE(a.name, CASE WHEN cm.member_id = '00000000-0000-0000-0000-000000000001' THEN 'assistant' ELSE 'Agent' END)
                ELSE cm.member_id
              END AS name
       FROM channel_members cm
       LEFT JOIN users u ON cm.member_type = 'user' AND u.id = cm.member_id
       LEFT JOIN agents a ON cm.member_type = 'agent' AND a.id = cm.member_id
       WHERE cm.channel_id = ?
       ORDER BY cm.member_type, name`,
    () => [props.channelId]
  );

  // Fuzzy search utility (same as MentionAutocomplete)
  function fuzzyMatch(text: string, query: string): boolean {
    if (!query) return true;
    text = text.toLowerCase();
    query = query.toLowerCase();
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

  // Get filtered mention options
  const mentionOptions = createMemo(() => {
    const state = mentionState();
    const q = state.query.toLowerCase();
    const list = (members.data || []).map((m) => ({
      type: m.member_type,
      id: m.member_id,
      name:
        m.name ||
        (m.member_id === "00000000-0000-0000-0000-000000000001"
          ? "assistant"
          : "user"),
    }));
    return list.filter((o) => fuzzyMatch(o.name, q));
  });

  const handleMentionSelect = (name: string) => {
    const state = mentionState();
    if (state.isOpen) {
      const before = content().slice(0, state.cursorPosition);
      const after = content().slice(
        state.cursorPosition + state.query.length + 1
      );
      setContent(before + "@" + name + " " + after);
      setActiveMentionIndex(0);
    }
  };

  const handleSend = async () => {
    const text = content().trim();
    if (!text) return;
    setContent("");

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
      // Note: This duplication of member name resolution is acceptable per VSA principles.
      // Each slice maintains independence. If duplicated a third time, extract to shared utility.
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
          text,
          username
        );
        console.log("[send] Agent processing complete");
      }
    } catch (error: unknown) {
      console.error("[send] error", error);
      // Error will be handled by the server function
    }
  };

  return (
    <div class="border-t border-gray-200 p-4 bg-white">
      <div class="flex gap-2 relative">
        <div class="flex-1 relative">
          <input
            type="text"
            value={content()}
            onInput={(e) => setContent(e.currentTarget.value)}
            onKeyDown={(e) => {
              const state = mentionState();
              if (state.isOpen) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  const options = mentionOptions();
                  setActiveMentionIndex((prev) =>
                    Math.min(options.length - 1, prev + 1)
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveMentionIndex((prev) => Math.max(0, prev - 1));
                } else if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const options = mentionOptions();
                  const activeOption = options[activeMentionIndex()];
                  if (activeOption) {
                    handleMentionSelect(activeOption.name);
                  }
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  const before = content().slice(0, state.cursorPosition);
                  const after = content().slice(
                    state.cursorPosition + state.query.length + 1
                  );
                  setContent(before + after);
                  setActiveMentionIndex(0);
                }
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message #${props.channelName || "channel"}...`}
            class="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-400 bg-white"
          />
          <MentionAutocomplete
            channelId={props.channelId}
            mentionQuery={mentionState().query}
            isOpen={mentionState().isOpen}
            activeIndex={activeMentionIndex()}
            onSelect={handleMentionSelect}
            onActiveIndexChange={setActiveMentionIndex}
          />
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
