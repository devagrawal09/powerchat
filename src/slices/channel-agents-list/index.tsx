import { For, Show } from "solid-js";
import { and, coalesce, eq, useLiveQuery } from "@tanstack/solid-db";
import { agentsCollection, channelMembersCollection } from "~/lib/tanstack-db";

type ChannelAgentsListProps = {
  channelId: string;
  onAgentClick: (agentId: string) => void;
};

export function ChannelAgentsList(props: ChannelAgentsListProps) {
  const agentsInChannel = useLiveQuery((q) =>
    q
      .from({ member: channelMembersCollection })
      .leftJoin(
        { agent: agentsCollection },
        ({ member, agent }) => eq(agent.id, member.member_id),
      )
      .where(({ member }) =>
        and(
          eq(member.channel_id, props.channelId),
          eq(member.member_type, "agent"),
        ),
      )
      .orderBy(({ member, agent }) => coalesce(agent?.name, member.member_id))
      .select(({ member, agent }) => ({
        member_id: member.member_id,
        agent_name: coalesce(agent?.name, member.member_id),
      })),
  );

  return (
    <>
      <div class="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">
        Agents
      </div>
      <Show when={!agentsInChannel.isLoading && agentsInChannel.isReady}>
        <For each={agentsInChannel()}>
          {(data) => (
            <div
              onClick={() => props.onAgentClick(data.member_id!)}
              class="text-sm text-gray-900 py-1 cursor-pointer hover:text-blue-600 hover:underline"
            >
              {data.agent_name}
            </div>
          )}
        </For>
      </Show>
    </>
  );
}
