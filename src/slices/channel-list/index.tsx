import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { asc } from "drizzle-orm";
import { channels, clientDb, liveQuery } from "~/db/client";
import { DeleteChannel } from "~/slices/delete-channel";
import { useQuery } from "~/lib/powersync-solid";
import { ChannelListHeader, CreateChannel } from "~/slices/create-channel";

export function ChannelList() {
  const [showCreate, setShowCreate] = createSignal(false);

  const channelsQuery = useQuery(() =>
    liveQuery(
      clientDb
        .select({
          id: channels.id,
          name: channels.name,
          created_by: channels.createdBy,
          created_at: channels.createdAt,
        })
        .from(channels)
        .orderBy(asc(channels.name)),
    ),
  );

  return (
    <div class="flex-1 overflow-y-auto p-2">
      <ChannelListHeader onAdd={() => setShowCreate((v) => !v)} />
      <Show when={showCreate()}>
        <CreateChannel onCreated={() => setShowCreate((v) => !v)} />
      </Show>
      <Show
        when={!channelsQuery().isLoading}
        fallback={<div class="px-2 text-sm text-gray-500">Loading...</div>}
      >
        <For each={channelsQuery().data}>
          {(channel) => (
            <div class="flex items-center group">
              <A
                href={`/channel/${channel.id}`}
                class="flex-1 px-2 py-1.5 rounded hover:bg-gray-100 text-sm text-gray-900 transition-colors"
                activeClass="!bg-blue-50 !text-blue-600 font-medium"
              >
                # {channel.name}
              </A>
              <DeleteChannel
                channelId={channel.id}
                channelName={channel.name}
              />
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
