import { For, Show } from "solid-js";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";

type MemberRow = {
  member_type: "user";
  member_id: string;
  name: string | null;
};

type ChannelMemberListProps = {
  channelId: string;
};

export function ChannelMemberList(props: ChannelMemberListProps) {
  // Users in channel
  const users = useQuery<MemberRow>(
    () =>
      `SELECT 'user' as member_type, cm.member_id as member_id, COALESCE(u.id, cm.member_id) as name
       FROM channel_members cm
       LEFT JOIN users u ON cm.member_type = 'user' AND u.id = cm.member_id
       WHERE cm.channel_id = ? AND cm.member_type = 'user'
       ORDER BY name`,
    () => [props.channelId]
  );

  return (
    <>
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Members</h3>

      <div class="text-xs font-semibold text-gray-500 uppercase mb-2">
        Users
      </div>
      <Show when={!users().isLoading}>
        <For each={users().data}>
          {(member) => (
            <div class="text-sm text-gray-900 py-1">{member.name}</div>
          )}
        </For>
      </Show>
    </>
  );
}
