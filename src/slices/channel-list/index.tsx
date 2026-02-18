import { For, Show, createMemo } from "solid-js";
import { A } from "@solidjs/router";
import { and, eq, useLiveQuery } from "@tanstack/solid-db";
import { DeleteChannel } from "~/slices/delete-channel";
import { getUsername } from "~/lib/getUsername";
import { channelMembersCollection, channelsCollection } from "~/lib/tanstack-db";

type ChannelRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export function ChannelList(props: { username?: string | null }) {
  const username = createMemo(() => props.username ?? getUsername());

  const channels = useLiveQuery((q) =>
    q
      .from({ channel: channelsCollection })
      .innerJoin({ member: channelMembersCollection }, ({ channel, member }) =>
        eq(member.channel_id, channel.id),
      )
      .where(({ member }) =>
        and(eq(member.member_type, "user"), eq(member.member_id, username() || "")),
      )
      .orderBy(({ channel }) => channel.created_at, "desc")
      .select(({ channel }) => ({
        id: channel.id,
        name: channel.name,
        created_by: channel.created_by,
        created_at: channel.created_at,
      })),
  );

  return (
    <div class="flex-1 overflow-y-auto p-2">
      <div class="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">
        Channels
      </div>
      <Show
        when={!channels.isLoading && channels.isReady}
        fallback={<div class="px-2 text-sm text-gray-500">Loading...</div>}
      >
        <For each={channels()}>
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
