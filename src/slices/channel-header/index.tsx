import { Show } from "solid-js";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";

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
  const channel = useQuery<ChannelRow>(
    () => `SELECT * FROM channels WHERE id = ?`,
    () => [props.channelId]
  );

  const channelName = () => channel().data?.[0]?.name;

  return (
    <div class="border-b border-gray-200 p-4 bg-white">
      <Show
        when={!channel().isLoading}
        fallback={
          <div class="text-lg font-semibold text-gray-900">Loading...</div>
        }
      >
        <h2 class="text-lg font-semibold text-gray-900"># {channelName()}</h2>
      </Show>
    </div>
  );
}
