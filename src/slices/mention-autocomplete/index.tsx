import { createMemo, For, Show } from "solid-js";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";

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
    () => [props.channelId]
  );

  const documents = useQuery<DocumentRow>(
    () =>
      `SELECT id, title, description
       FROM documents
       WHERE channel_id = ?
       ORDER BY created_at DESC`,
    () => [props.channelId]
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
