import { eq } from "drizzle-orm";
import { channels, clientDb, liveQuery } from "~/db/client";
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
  const channel = useQuery(
    () =>
      liveQuery(
        clientDb
          .select({
            id: channels.id,
            name: channels.name,
            created_by: channels.createdBy,
            created_at: channels.createdAt,
          })
          .from(channels)
          .where(eq(channels.id, props.channelId)),
      ),
  );

  const channelName = () => channel().data?.[0]?.name;

  return (
    <div class="border-b border-gray-200 p-4 bg-white">
      <h2 class="text-lg font-semibold text-gray-900"># {channelName()}</h2>
    </div>
  );
}
