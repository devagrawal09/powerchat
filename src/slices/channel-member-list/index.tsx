import { For, Show, createMemo } from "solid-js";
import { and, coalesce, eq, useLiveQuery } from "@tanstack/solid-db";
import { channelMembersCollection, usersCollection } from "~/lib/tanstack-db";

type MemberRow = {
  member_type: "user";
  member_id: string;
  name: string | null;
};

type ChannelMemberListProps = {
  channelId: string;
};

export function ChannelMemberList(props: ChannelMemberListProps) {
  const usersInChannel = useLiveQuery((q) =>
    q
      .from({ member: channelMembersCollection })
      .leftJoin({ user: usersCollection }, ({ member, user }) =>
        eq(user.id, member.member_id),
      )
      .where(({ member }) =>
        and(eq(member.channel_id, props.channelId), eq(member.member_type, "user")),
      )
      .orderBy(({ member, user }) => coalesce(user.id, member.member_id))
      .select(({ member, user }) => ({
        member_id: member.member_id,
        user_id: user.id,
      })),
  );

  const users = createMemo<MemberRow[]>(() =>
    usersInChannel()
      .map((entry) => ({
        member_type: "user" as const,
        member_id: entry.member_id,
        name: entry.user_id ?? entry.member_id,
      })),
  );

  return (
    <>
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Members</h3>

      <div class="text-xs font-semibold text-gray-500 uppercase mb-2">
        Users
      </div>
      <Show when={!usersInChannel.isLoading && usersInChannel.isReady}>
        <For each={users()}>
          {(member) => (
            <div class="text-sm text-gray-900 py-1">{member.name}</div>
          )}
        </For>
      </Show>
    </>
  );
}
