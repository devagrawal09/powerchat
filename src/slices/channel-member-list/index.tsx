import { and, asc, eq, sql } from "drizzle-orm";
import {
  channelMembers,
  clientDb,
  liveQuery,
  users as usersTable,
} from "~/db/client";
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
  const memberName = sql<string>`coalesce(${usersTable.id}, ${channelMembers.memberId})`;

  const users = useQuery(() =>
    liveQuery(
      clientDb
        .select({
          member_type: sql<"user">`'user'`,
          member_id: channelMembers.memberId,
          name: memberName,
        })
        .from(channelMembers)
        .leftJoin(
          usersTable,
          and(
            eq(channelMembers.memberType, "user"),
            eq(usersTable.id, channelMembers.memberId),
          ),
        )
        .where(
          and(
            eq(channelMembers.channelId, props.channelId),
            eq(channelMembers.memberType, "user"),
          ),
        )
        .orderBy(asc(memberName)),
    ),
  );

  return (
    <>
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
