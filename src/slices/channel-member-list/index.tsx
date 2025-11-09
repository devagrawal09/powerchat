import { For, Show } from "solid-js";
import { useWatchedQuery } from "~/lib/useWatchedQuery";

type MemberRow = {
  member_type: "user" | "agent";
  member_id: string;
  name: string | null;
};

type ChannelMemberListProps = {
  channelId: string;
};

export function ChannelMemberList(props: ChannelMemberListProps) {
  // Users in channel
  const users = useWatchedQuery<MemberRow>(
    () =>
      `SELECT 'user' as member_type, cm.member_id as member_id, COALESCE(u.id, cm.member_id) as name
       FROM channel_members cm
       LEFT JOIN users u ON cm.member_type = 'user' AND u.id = cm.member_id
       WHERE cm.channel_id = ? AND cm.member_type = 'user'
       ORDER BY name`,
    () => [props.channelId]
  );

  // Agents in channel
  const agents = useWatchedQuery<MemberRow>(
    () =>
      `SELECT 'agent' as member_type, cm.member_id as member_id,
              COALESCE(a.name, 'Agent') as name
       FROM channel_members cm
       LEFT JOIN agents a ON cm.member_type = 'agent' AND a.id = cm.member_id
       WHERE cm.channel_id = ? AND cm.member_type = 'agent'
       ORDER BY name`,
    () => [props.channelId]
  );

  return (
    <aside class="w-64 border-l border-gray-200 bg-white p-4 overflow-y-auto">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Members</h3>

      <div class="text-xs font-semibold text-gray-500 uppercase mb-2">
        Users
      </div>
      <Show when={!users.loading}>
        <For each={users.data}>
          {(member) => (
            <div class="text-sm text-gray-900 py-1">{member.name}</div>
          )}
        </For>
      </Show>

      <div class="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">
        Agents
      </div>
      <Show when={!agents.loading}>
        <For each={agents.data}>
          {(member) => (
            <div class="text-sm text-gray-900 py-1">{member.name}</div>
          )}
        </For>
      </Show>
    </aside>
  );
}
