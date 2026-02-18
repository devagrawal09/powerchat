import { Show } from "solid-js";
import { eq, useLiveQuery } from "@tanstack/solid-db";
import { channelsCollection } from "~/lib/tanstack-db";

type ChannelRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

type ChannelHeaderProps = {
  channelId: string;
};

export function ChannelHeader(props: ChannelHeaderProps) {
  const channel = useLiveQuery((q) =>
    q
      .from({ channel: channelsCollection })
      .where(({ channel }) => eq(channel.id, props.channelId))
      .select(({ channel }) => ({
        id: channel.id,
        name: channel.name,
        created_by: channel.created_by,
        created_at: channel.created_at,
      })),
  );

  const channelName = () => channel()[0]?.name;

  return (
    <div class="border-b border-gray-200 p-4 bg-white">
      <Show
        when={!channel.isLoading && channel.isReady}
        fallback={
          <div class="text-lg font-semibold text-gray-900">Loading...</div>
        }
      >
        <h2 class="text-lg font-semibold text-gray-900"># {channelName()}</h2>
      </Show>
    </div>
  );
}
