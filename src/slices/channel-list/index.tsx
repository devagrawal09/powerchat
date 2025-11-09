import { For, Show, createMemo } from "solid-js";
import { A } from "@solidjs/router";
import { useWatchedQuery } from "~/lib/useWatchedQuery";
import { DeleteChannel } from "~/slices/delete-channel";
import { getUsername } from "~/lib/getUsername";

type ChannelRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export function ChannelList() {
  const username = createMemo(() => getUsername());

  const channels = useWatchedQuery<ChannelRow>(
    () =>
      `SELECT c.* FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id
       WHERE cm.member_type = 'user' AND cm.member_id = ?
       ORDER BY c.created_at DESC`,
    () => [username() || ""]
  );

  return (
    <div class="flex-1 overflow-y-auto p-2">
      <div class="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">
        Channels
      </div>
      <Show
        when={!channels.loading}
        fallback={<div class="px-2 text-sm text-gray-500">Loading...</div>}
      >
        <For each={channels.data}>
          {(channel) => (
            <div class="flex items-center group">
              <A
                href={`/channel/${channel.id}`}
                class="flex-1 px-2 py-1.5 rounded hover:bg-gray-100 text-sm text-gray-900"
                activeClass="bg-blue-50 text-blue-600"
              >
                # {channel.name}
              </A>
              <DeleteChannel channelId={channel.id} />
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
