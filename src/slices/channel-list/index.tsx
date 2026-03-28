import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { channelQuery } from "~/db";
import { DeleteChannel } from "~/slices/delete-channel";
import { useIsoQuery } from "~/lib/isomorphic";

type ChannelRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export function ChannelList() {
  const channels = useIsoQuery<ChannelRow>(channelQuery);
  return (
    <div class="flex-1 overflow-y-auto p-2">
      <div class="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">
        Channels
      </div>
      <Show
        when={!channels().isLoading}
        fallback={<div class="px-2 text-sm text-gray-500">Loading...</div>}
      >
        <For each={channels().data}>
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
