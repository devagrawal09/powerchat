import { and, asc, eq, sql } from "drizzle-orm";
import {
  agents,
  channelMembers,
  clientDb,
  liveQuery,
  messages,
  users,
} from "~/db/client";
import { createMemo, createSignal } from "solid-js";
import { getUsername } from "~/lib/getUsername";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";
import {
  MentionAutocomplete,
  type MentionOption,
} from "~/slices/mention-autocomplete";

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
  let textareaRef: HTMLTextAreaElement | undefined;
  const [content, setContent] = createSignal("");
  const [activeMentionIndex, setActiveMentionIndex] = createSignal(0);
  const [selectedAgent, setSelectedAgent] = createSignal<SelectedAgent | null>(
    null,
  );

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const memberName = sql<string>`
    case
      when ${channelMembers.memberType} = 'user' then coalesce(${users.id}, ${channelMembers.memberId})
      when ${channelMembers.memberType} = 'agent' then coalesce(${agents.name}, 'Agent')
      else ${channelMembers.memberId}
    end
  `;

  const mentionState = createMemo(() => {
    const match = content().match(/@([a-z0-9_]*)$/i);
    if (!match) {
      return { isOpen: false, query: "", cursorPosition: -1 };
    }

    return {
      isOpen: true,
      query: match[1],
      cursorPosition: match.index ?? -1,
    };
  });

  const members = useQuery(() =>
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

  function fuzzyMatch(text: string, query: string): boolean {
    if (!query) return true;

    const haystack = text.toLowerCase();
    const needle = query.toLowerCase();
    let haystackIndex = 0;
    let needleIndex = 0;

    while (haystackIndex < haystack.length && needleIndex < needle.length) {
      if (haystack[haystackIndex] === needle[needleIndex]) {
        needleIndex += 1;
      }
      haystackIndex += 1;
    }

    return needleIndex === needle.length;
  }

  const mentionOptions = createMemo<MentionOption[]>(() => {
    const state = mentionState();
    if (!state.isOpen) return [];

    return (members().data || [])
      .filter((member) => member.name)
      .map((member) => ({
        type: member.member_type as "user" | "agent",
        id: member.member_id,
        name: member.name!,
      }))
      .filter((option) => fuzzyMatch(option.name, state.query));
  });

  const agentStillMentioned = createMemo(() => {
    const agent = selectedAgent();
    if (!agent) return false;

    return new RegExp(`@${agent.name}\\b`, "i").test(content());
  });

  const effectiveSelectedAgent = createMemo(() => {
    const agent = selectedAgent();
    if (agent && !agentStillMentioned()) {
      queueMicrotask(() => setSelectedAgent(null));
      return null;
    }

    return agent;
  });

  const handleMentionSelect = (option: MentionOption) => {
    const state = mentionState();
    if (!state.isOpen) return;

    const before = content().slice(0, state.cursorPosition);
    const after = content().slice(
      state.cursorPosition + state.query.length + 1,
    );
    setContent(before + "@" + option.name + " " + after);
    setActiveMentionIndex(0);

    if (option.type === "agent") {
      setSelectedAgent({ id: option.id, name: option.name, type: "agent" });
    }
  };

  const handleSend = async () => {
    const text = content().trim();
    if (!text) return;

    const agent = effectiveSelectedAgent();
    const mentionedAgent = agent
      ? JSON.stringify({ id: agent.id, type: "agent", name: agent.name })
      : null;

    setContent("");
    setSelectedAgent(null);

    try {
      const username = getUsername();
      if (!username) {
        console.error("[send] No username found");
        return;
      }

      await clientDb.insert(messages).values({
        id: crypto.randomUUID(),
        channelId: props.channelId,
        authorType: "user",
        authorId: username,
        content: text,
        mentionedAgent,
        createdAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error("[send] error", error);
    }
  };

  const hasAgent = () => effectiveSelectedAgent() !== null;

  return (
    <div class="border-t border-gray-200 px-4 py-2 bg-white">
      <div class="flex gap-2 relative my-0.5">
        <textarea
          ref={textareaRef}
          value={content()}
          onInput={(e) => {
            setContent(e.currentTarget.value);
            autoResize(e.currentTarget);
          }}
          onKeyDown={(e) => {
            const state = mentionState();
            if (state.isOpen) {
              const options = mentionOptions();
              const isOptionDisabled = (idx: number) => {
                const option = options[idx];
                return option?.type === "agent" && hasAgent();
              };

              if (e.key === "ArrowDown") {
                e.preventDefault();
                let next = activeMentionIndex() + 1;
                while (next < options.length && isOptionDisabled(next))
                  next += 1;
                if (next < options.length) setActiveMentionIndex(next);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                let prev = activeMentionIndex() - 1;
                while (prev >= 0 && isOptionDisabled(prev)) prev -= 1;
                if (prev >= 0) setActiveMentionIndex(prev);
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const option = options[activeMentionIndex()];
                if (option && !(option.type === "agent" && hasAgent())) {
                  handleMentionSelect(option);
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
              // Reset textarea height after send
              if (textareaRef) {
                textareaRef.style.height = "auto";
              }
            }
          }}
          placeholder={`Message #${props.channelName || "channel"}...`}
          rows={1}
          class={`input resize-none overflow-hidden transition-colors h-10 ${
            hasAgent()
              ? "border-purple-400! ring-1 ring-purple-300 bg-purple-50/30!"
              : ""
          }`}
        />
        <MentionAutocomplete
          options={mentionOptions()}
          isOpen={mentionState().isOpen}
          activeIndex={activeMentionIndex()}
          disabledAgents={hasAgent()}
          onSelect={handleMentionSelect}
          onActiveIndexChange={setActiveMentionIndex}
        />
        <button
          onClick={() => {
            handleSend();
            if (textareaRef) textareaRef.style.height = "auto";
          }}
          disabled={!content().trim()}
          class="btn btn-primary px-5 h-10"
        >
          Send
        </button>
      </div>
    </div>
  );
}
