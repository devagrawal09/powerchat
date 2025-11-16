import { For, Show } from "solid-js";
import { useWatchedQuery } from "~/lib/useWatchedQuery";

type MemberRow = {
  member_type: "agent";
  member_id: string;
  name: string | null;
};

type ChannelAgentsListProps = {
  channelId: string;
  onAgentClick: (agentId: string) => void;
};

export function ChannelAgentsList(props: ChannelAgentsListProps) {
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
    <>
      <div class="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">
        Agents
      </div>
      <Show when={!agents.loading}>
        <For each={agents.data}>
          {(member) => (
            <div
              onClick={() => props.onAgentClick(member.member_id)}
              class="text-sm text-gray-900 py-1 cursor-pointer hover:text-blue-600 hover:underline"
            >
              {member.name}
            </div>
          )}
        </For>
      </Show>
    </>
  );
}
