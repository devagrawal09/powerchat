import { and, eq, sql } from "drizzle-orm";
import { channels, channelMembers, clientDb, liveQuery } from "~/db/client";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";

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

  const memberCount = useQuery(
    () =>
      liveQuery(
        clientDb
          .select({
            count: sql<number>`count(*)`,
          })
          .from(channelMembers)
          .where(
            and(
              eq(channelMembers.channelId, props.channelId),
              eq(channelMembers.memberType, "user"),
            ),
          ),
      ),
  );

  const channelName = () => channel().data?.[0]?.name;
  const channelCreatedBy = () => channel().data?.[0]?.created_by;
  const count = () => memberCount().data?.[0]?.count ?? 0;

  return (
    <div class="h-12 border-b border-gray-200 px-4 bg-white flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3 min-w-0">
        <h2 class="text-lg font-semibold text-gray-900 shrink-0">
          # {channelName()}
        </h2>
        <div class="hidden sm:flex items-center gap-2 text-xs text-gray-400">
          <span class="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="7" cy="4.5" r="2.5" />
              <path d="M2 12.5c0-2.5 2.24-4 5-4s5 1.5 5 4" />
            </svg>
            {count()} {count() === 1 ? "member" : "members"}
          </span>
          <span class="text-gray-300">|</span>
          <span class="truncate">
            Created by {channelCreatedBy() || "unknown"}
          </span>
        </div>
      </div>
    </div>
  );
}
