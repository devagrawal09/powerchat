import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  agents,
  channelMembers,
  clientDb,
  documents as documentsTable,
  liveQuery,
  messages,
  users,
} from "~/db/client";
import { createSignal, createMemo } from "solid-js";
import { getUsername } from "~/lib/getUsername";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";
import {
  MentionAutocomplete,
  type MentionOption,
} from "~/slices/mention-autocomplete";

type MemberRow = {
  member_type: string;
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
  const memberName = sql<string>`
    case
      when ${channelMembers.memberType} = 'user' then coalesce(${users.id}, ${channelMembers.memberId})
      when ${channelMembers.memberType} = 'agent' then coalesce(${agents.name}, 'Agent')
      else ${channelMembers.memberId}
    end
  `;

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

  const members = useQuery(
    () =>
      liveQuery(
        clientDb
          .select({
            member_type: channelMembers.memberType,
            member_id: channelMembers.memberId,
            name: memberName,
          })
          .from(channelMembers)
          .leftJoin(
            users,
            and(
              eq(channelMembers.memberType, "user"),
              eq(users.id, channelMembers.memberId),
            ),
          )
          .leftJoin(
            agents,
            and(
              eq(channelMembers.memberType, "agent"),
              eq(agents.id, channelMembers.memberId),
            ),
          )
          .where(eq(channelMembers.channelId, props.channelId))
          .orderBy(asc(channelMembers.memberType), asc(memberName)),
      ),
  );

  const documents = useQuery(
    () =>
      liveQuery(
        clientDb
          .select({
            id: documentsTable.id,
            title: documentsTable.title,
            description: documentsTable.description,
          })
          .from(documentsTable)
          .where(eq(documentsTable.channelId, props.channelId))
          .orderBy(desc(documentsTable.createdAt)),
      ),
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

      console.log("before writeTransaction", {
        username,
        messageId,
        text,
        mentionedAgent,
      });

      const t = clientDb.insert(messages).values({
        id: messageId,
        channelId: props.channelId,
        authorType: "user",
        authorId: username,
        content: text,
        mentionedAgent,
        createdAt: userMessageCreatedAt,
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
