import { createMemo, For, Show } from "solid-js";
import { and, coalesce, eq, useLiveQuery } from "@tanstack/solid-db";
import {
  agentsCollection,
  channelMembersCollection,
  documentsCollection,
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

type MentionAutocompleteProps = {
  channelId: string;
  mentionQuery: string;
  mentionType: "@" | "#";
  isOpen: boolean;
  activeIndex: number;
  onSelect: (name: string) => void;
  onActiveIndexChange: (index: number) => void;
};

export function MentionAutocomplete(props: MentionAutocompleteProps) {
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

  // Fuzzy search utility
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

  // Filtered mention options
  const mentionOptions = createMemo(() => {
    const q = (props.mentionQuery || "").toLowerCase();

    if (props.mentionType === "#") {
      // Document mentions
      const list = documents().map((d) => ({
        type: "document" as const,
        id: d.id,
        name: d.title,
      }));
      return list.filter((o) => fuzzyMatch(o.name, q));
    } else {
      // Member mentions
      const list = members()
        .filter((m) => m.name)
        .map((m) => ({
          type: m.member_type,
          id: m.member_id,
          name: m.name!,
        }));
      return list.filter((o) => fuzzyMatch(o.name, q));
    }
  });

  return (
    <Show when={props.isOpen && mentionOptions().length > 0}>
      <div class="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-auto bg-white border border-gray-200 rounded shadow z-50">
        <For each={mentionOptions()}>
          {(opt, idx) => (
            <button
              type="button"
              class={`${
                idx() === props.activeIndex ? "bg-blue-50" : "bg-white"
              } w-full text-left px-3 py-2`}
              onMouseDown={(e) => {
                e.preventDefault();
                props.onSelect(opt.name);
              }}
              onMouseEnter={() => props.onActiveIndexChange(idx())}
            >
              <span class="text-xs uppercase text-gray-500 mr-2">
                {opt.type}
              </span>
              <span class="text-gray-900">
                {props.mentionType === "#" ? "#" : "@"}
                {opt.name}
              </span>
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}
