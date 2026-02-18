import { createSignal, createMemo } from "solid-js";
import { and, coalesce, eq, useLiveQuery } from "@tanstack/solid-db";
import { getUsername } from "~/lib/getUsername";
import { MentionAutocomplete } from "~/slices/mention-autocomplete";
import {
  agentsCollection,
  channelMembersCollection,
  documentsCollection,
  ensureTanStackDbReady,
  messagesCollection,
  usersCollection,
} from "~/lib/tanstack-db";

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

type ChatInputProps = {
  channelId: string;
  channelName?: string;
};

export function ChatInput(props: ChatInputProps) {
  const [content, setContent] = createSignal("");
  const [activeMentionIndex, setActiveMentionIndex] = createSignal(0);

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

  const mentionQuery = createMemo(() => activeMentionState()?.query ?? "");
  const mentionType = createMemo<"@" | "#">(
    () => activeMentionState()?.type ?? "@",
  );
  const mentionIsOpen = createMemo(() => activeMentionState()?.isOpen ?? false);

  // Query members for agent mention detection and resolution
  // Note: This query is needed for the mutation logic (resolving agent IDs from mentions)
  // The autocomplete UI is handled by the separate MentionAutocomplete slice
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
      .orderBy(({ member }) => member.member_type)
      .orderBy(({ member, user, agent }) =>
        coalesce(user.id, agent.name, member.member_id),
      )
      .select(({ member, user, agent }) => ({
        member_type: member.member_type,
        member_id: member.member_id,
        user_name: user.id,
        agent_name: agent.name,
      })),
  );

  const members = createMemo<MemberRow[]>(() =>
    membersInChannel()
      .map((member) => ({
        member_type: member.member_type,
        member_id: member.member_id,
        name:
          member.member_type === "user"
            ? (member.user_name ?? member.member_id)
            : (member.agent_name ?? "Agent"),
      })),
  );

  // Query documents for document mention autocomplete
  const documents = useLiveQuery((q) =>
    q
      .from({ document: documentsCollection })
      .where(({ document }) => eq(document.channel_id, props.channelId))
      .orderBy(({ document }) => document.created_at, "desc")
      .select(({ document }) => ({
        id: document.id,
        title: document.title,
        description: document.description,
      })),
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
    const list = members()
      .filter((m) => m.name)
      .map((m) => ({
        type: m.member_type,
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
    const list = documents().map((d) => ({
      type: "document" as const,
      id: d.id,
      name: d.title,
    }));
    return list.filter((o) => fuzzyMatch(o.name, q));
  });

  const handleMentionSelect = (name: string) => {
    const state = activeMentionState();
    if (state?.isOpen) {
      const before = content().slice(0, state.cursorPosition);
      const after = content().slice(
        state.cursorPosition + state.query.length + 1,
      );
      const prefix = state.type === "#" ? "#" : "@";
      setContent(before + prefix + name + " " + after);
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

      await ensureTanStackDbReady();
      await messagesCollection
        .insert({
          id: messageId,
          channel_id: props.channelId,
          author_type: "user",
          author_id: username,
          content: text,
          created_at: userMessageCreatedAt,
        })
        .isPersisted.promise;

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
              const state = activeMentionState();
              if (state?.isOpen) {
                const options =
                  state.type === "#"
                    ? documentMentionOptions()
                    : mentionOptions();
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveMentionIndex((prev) =>
                    Math.min(options.length - 1, prev + 1),
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveMentionIndex((prev) => Math.max(0, prev - 1));
                } else if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const activeOption = options[activeMentionIndex()];
                  if (activeOption) {
                    handleMentionSelect(activeOption.name);
                  }
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  const before = content().slice(0, state.cursorPosition);
                  const after = content().slice(
                    state.cursorPosition + (state.query?.length ?? 0) + 1,
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
            mentionQuery={mentionQuery()}
            mentionType={mentionType()}
            isOpen={mentionIsOpen()}
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
