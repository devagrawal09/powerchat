import { createMemo, For, Show } from "solid-js";
import { useWatchedQuery } from "~/lib/useWatchedQuery";

type MemberRow = {
  member_type: "user" | "agent";
  member_id: string;
  name: string | null;
};

type MentionAutocompleteProps = {
  channelId: string;
  mentionQuery: string;
  isOpen: boolean;
  activeIndex: number;
  onSelect: (name: string) => void;
  onActiveIndexChange: (index: number) => void;
};

export function MentionAutocomplete(props: MentionAutocompleteProps) {
  const members = useWatchedQuery<MemberRow>(
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
    const list = (members.data || [])
      .filter((m) => m.name)
      .map((m) => ({
        type: m.member_type,
        id: m.member_id,
        name: m.name!,
      }));
    const filtered = list.filter((o) => fuzzyMatch(o.name, q));
    return filtered;
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
              <span class="text-gray-900">@{opt.name}</span>
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}
