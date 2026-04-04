import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  agents,
  channelMembers,
  clientDb,
  documents as documentsTable,
  liveQuery,
  users,
} from "~/db/client";
import { createMemo, For, Show } from "solid-js";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";

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

export type MentionOption = {
  type: "user" | "agent" | "document";
  id: string;
  name: string;
};

type MentionAutocompleteProps = {
  channelId: string;
  mentionQuery: string;
  mentionType: "@" | "#";
  isOpen: boolean;
  activeIndex: number;
  disabledAgents: boolean;
  onSelect: (option: MentionOption) => void;
  onActiveIndexChange: (index: number) => void;
};

export function MentionAutocomplete(props: MentionAutocompleteProps) {
  const memberName = sql<string>`
    case
      when ${channelMembers.memberType} = 'user' then coalesce(${users.id}, ${channelMembers.memberId})
      when ${channelMembers.memberType} = 'agent' then coalesce(${agents.name}, 'Agent')
      else ${channelMembers.memberId}
    end
  `;

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
    const q = props.mentionQuery.toLowerCase();

    if (props.mentionType === "#") {
      // Document mentions
      const list = (documents().data || []).map((d) => ({
        type: "document" as const,
        id: d.id,
        name: d.title,
      }));
      return list.filter((o) => fuzzyMatch(o.name, q));
    } else {
      // Member mentions
      const list = (members().data || [])
        .filter((m) => m.name)
        .map((m) => ({
          type: m.member_type as "user" | "agent",
          id: m.member_id,
          name: m.name!,
        }));
      return list.filter((o) => fuzzyMatch(o.name, q));
    }
  });

  // Selectable options (agents may be disabled)
  const selectableOptions = createMemo(() => {
    return mentionOptions().filter(
      (o) => !(o.type === "agent" && props.disabledAgents),
    );
  });

  return (
    <Show when={props.isOpen && mentionOptions().length > 0}>
      <div class="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-auto bg-white border border-gray-200 rounded shadow z-50">
        <For each={mentionOptions()}>
          {(opt, idx) => {
            const isDisabled = () => opt.type === "agent" && props.disabledAgents;
            // Compute active index among all options
            const isActive = () => idx() === props.activeIndex;

            return (
              <button
                type="button"
                class={`w-full text-left px-3 py-2 ${
                  isDisabled()
                    ? "opacity-40 cursor-not-allowed bg-gray-50"
                    : isActive()
                      ? "bg-blue-50"
                      : "bg-white hover:bg-gray-50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!isDisabled()) {
                    props.onSelect(opt);
                  }
                }}
                onMouseEnter={() => {
                  if (!isDisabled()) {
                    props.onActiveIndexChange(idx());
                  }
                }}
              >
                <span
                  class={`text-xs uppercase mr-2 ${
                    opt.type === "agent"
                      ? "text-purple-600 font-semibold"
                      : "text-gray-500"
                  }`}
                >
                  {opt.type === "agent" ? "agent" : opt.type}
                </span>
                <span class={`${isDisabled() ? "text-gray-400" : "text-gray-900"}`}>
                  {props.mentionType === "#" ? "#" : "@"}
                  {opt.name}
                </span>
                {isDisabled() && (
                  <span class="text-xs text-gray-400 ml-2">(limit 1 per message)</span>
                )}
              </button>
            );
          }}
        </For>
      </div>
    </Show>
  );
}
