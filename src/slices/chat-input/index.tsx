import { createSignal, createMemo } from "solid-js";
import { getUsername } from "~/lib/getUsername";
import { usePowerSync } from "~/lib/powersync-solid";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";
import {
  MentionAutocomplete,
  type MentionOption,
} from "~/slices/mention-autocomplete";

type MemberRow = {
  member_type: "user" | "agent";
  member_id: string;
  name: string | null;
};

type DocumentRow = {
  id: string;
  title: string;
  description: string;
};

type SelectedAgent = {
  id: string;
  name: string;
  type: "agent";
};

type ChatInputProps = {
  channelId: string;
  channelName?: string;
};

export function ChatInput(props: ChatInputProps) {
  const [content, setContent] = createSignal("");
  const [activeMentionIndex, setActiveMentionIndex] = createSignal(0);
  const [selectedAgent, setSelectedAgent] = createSignal<SelectedAgent | null>(
    null,
  );
  const powersync = usePowerSync();

  // Detect mention query from content (@ for members)
  const mentionState = createMemo(() => {
    const text = content();
    const match = text.match(/@([a-z0-9_]*)$/i);
    if (match) {
      return {
        isOpen: true,
        query: match[1],
        cursorPosition: match.index!,
        type: "@" as const,
      };
    }
    return { isOpen: false, query: "", cursorPosition: -1, type: "@" as const };
  });

  // Detect document mention query from content (# for documents)
  const documentMentionState = createMemo(() => {
    const text = content();
    const match = text.match(/#([a-z0-9_]*)$/i);
    if (match) {
      return {
        isOpen: true,
        query: match[1],
        cursorPosition: match.index!,
        type: "#" as const,
      };
    }
    return { isOpen: false, query: "", cursorPosition: -1, type: "#" as const };
  });

  // Determine which mention type is active (prioritize # if both match)
  const activeMentionState = createMemo(() => {
    const docState = documentMentionState();
    const memberState = mentionState();
    if (docState.isOpen) return docState;
    if (memberState.isOpen) return memberState;
    return memberState; // default to member state for type
  });

  // Query members for mention autocomplete
  const members = useQuery<MemberRow>(
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
       WHERE cm.channel_id = ?
       ORDER BY cm.member_type, name`,
    () => [props.channelId],
  );

  // Query documents for document mention autocomplete
  const documents = useQuery<DocumentRow>(
    () =>
      `SELECT id, title, description
       FROM documents
       WHERE channel_id = ?
       ORDER BY created_at DESC`,
    () => [props.channelId],
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

  // Get filtered mention options (members)
  const mentionOptions = createMemo(() => {
    const state = mentionState();
    if (!state.isOpen) return [];
    const q = state.query.toLowerCase();
    const list = (members().data || [])
      .filter((m) => m.name)
      .map((m) => ({
        type: m.member_type as "user" | "agent",
        id: m.member_id,
        name: m.name!,
      }));
    return list.filter((o) => fuzzyMatch(o.name, q));
  });

  // Get filtered document mention options
  const documentMentionOptions = createMemo(() => {
    const state = documentMentionState();
    if (!state.isOpen) return [];
    const q = state.query.toLowerCase();
    const list = (documents().data || []).map((d) => ({
      type: "document" as const,
      id: d.id,
      name: d.title,
    }));
    return list.filter((o) => fuzzyMatch(o.name, q));
  });

  // Check if the agent mention text is still present in the content
  // This tracks removal of the agent mention to re-enable agent selection
  const agentStillMentioned = createMemo(() => {
    const agent = selectedAgent();
    if (!agent) return false;
    const text = content();
    const mentionPattern = new RegExp(`@${agent.name}\\b`, "i");
    return mentionPattern.test(text);
  });

  // Reactive: clear selectedAgent if the mention text is removed
  const effectiveSelectedAgent = createMemo(() => {
    const agent = selectedAgent();
    if (agent && !agentStillMentioned()) {
      // Defer the state update to avoid setting state during render
      queueMicrotask(() => setSelectedAgent(null));
      return null;
    }
    return agent;
  });

  const handleMentionSelect = (option: MentionOption) => {
    const state = activeMentionState();
    if (state.isOpen) {
      const before = content().slice(0, state.cursorPosition);
      const after = content().slice(
        state.cursorPosition + state.query.length + 1,
      );
      const prefix = state.type === "#" ? "#" : "@";
      setContent(before + prefix + option.name + " " + after);
      setActiveMentionIndex(0);

      // Track agent selection
      if (option.type === "agent") {
        setSelectedAgent({
          id: option.id,
          name: option.name,
          type: "agent",
        });
      }
    }
  };

  const handleSend = async () => {
    const text = content().trim();
    if (!text) return;

    // Capture agent metadata before clearing
    const agent = effectiveSelectedAgent();
    const mentionedAgent = agent
      ? JSON.stringify({ id: agent.id, type: "agent", name: agent.name })
      : null;

    setContent("");
    setSelectedAgent(null);

    try {
      const messageId = crypto.randomUUID();
      const username = getUsername();
      const userMessageCreatedAt = new Date().toISOString();

      if (!username) {
        console.error("[send] No username found");
        return;
      }

      if (!powersync) {
        console.error("[send] PowerSync not configured");
        return;
      }

      console.log("before writeTransaction", {
        username,
        messageId,
        text,
        mentionedAgent,
      });

      // Insert user message with agent metadata
      const t = powersync.writeTransaction(async (tx) => {
        console.log("before execute", {
          tx,
          messageId,
          channelId: props.channelId,
          username,
          text,
          mentionedAgent,
          userMessageCreatedAt,
        });
        const result = tx.execute(
          `INSERT INTO messages (id, channel_id, author_type, author_id, content, mentioned_agent, created_at)
           VALUES (?, ?, 'user', ?, ?, ?, ?)`,
          [
            messageId,
            props.channelId,
            username,
            text,
            mentionedAgent,
            userMessageCreatedAt,
          ],
        );
        console.log("after execute sync");

        await result;
        console.log("after execute async");
        return result;
      });

      console.log("after writeTransaction sync");
      await t;

      console.log("after writeTransaction async");
    } catch (error: unknown) {
      console.error("[send] error", error);
    }
  };

  const hasAgent = () => effectiveSelectedAgent() !== null;

  return (
    <div class="border-t border-gray-200 p-4 bg-white">
      <div class="flex gap-2 relative">
        <div class="flex-1 relative">
          <input
            type="text"
            value={content()}
            onInput={(e) => setContent(e.currentTarget.value)}
            onKeyDown={(e) => {
              const state = activeMentionState();
              if (state.isOpen) {
                const options =
                  state.type === "#"
                    ? documentMentionOptions()
                    : mentionOptions();
                // Skip disabled agent entries when navigating
                const isOptionDisabled = (idx: number) => {
                  const opt = options[idx];
                  return opt?.type === "agent" && hasAgent();
                };
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  let next = activeMentionIndex() + 1;
                  while (next < options.length && isOptionDisabled(next))
                    next++;
                  if (next < options.length) setActiveMentionIndex(next);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  let prev = activeMentionIndex() - 1;
                  while (prev >= 0 && isOptionDisabled(prev)) prev--;
                  if (prev >= 0) setActiveMentionIndex(prev);
                } else if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const activeOption = options[activeMentionIndex()];
                  if (
                    activeOption &&
                    !(activeOption.type === "agent" && hasAgent())
                  ) {
                    handleMentionSelect(activeOption);
                  }
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  const before = content().slice(0, state.cursorPosition);
                  const after = content().slice(
                    state.cursorPosition + state.query.length + 1,
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
            class={`w-full px-4 py-2 border rounded text-gray-900 placeholder-gray-400 bg-white transition-colors ${
              hasAgent()
                ? "border-purple-400 ring-1 ring-purple-300 bg-purple-50/30"
                : "border-gray-300"
            }`}
          />
          <MentionAutocomplete
            channelId={props.channelId}
            mentionQuery={activeMentionState().query}
            mentionType={activeMentionState().type}
            isOpen={activeMentionState().isOpen}
            activeIndex={activeMentionIndex()}
            disabledAgents={hasAgent()}
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
      {hasAgent() && (
        <div class="mt-1 flex items-center gap-1">
          <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Agent: {effectiveSelectedAgent()!.name}
          </span>
        </div>
      )}
    </div>
  );
}
