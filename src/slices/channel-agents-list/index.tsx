import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  agentRuns,
  agents as agentsTable,
  channelMembers,
  clientDb,
  liveQuery,
} from "~/db/client";
import { For, Show, createMemo } from "solid-js";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";

type AgentRunRow = {
  id: string;
  agent_id: string;
  status: string;
};

type ChannelAgentsListProps = {
  channelId: string;
  onAgentClick: (agentId: string) => void;
};

export function ChannelAgentsList(props: ChannelAgentsListProps) {
  const agentName = sql<string>`coalesce(${agentsTable.name}, 'Agent')`;

  const agents = useQuery(() =>
    liveQuery(
      clientDb
        .select({
          member_type: sql<"agent">`'agent'`,
          member_id: channelMembers.memberId,
          name: agentName,
        })
        .from(channelMembers)
        .leftJoin(
          agentsTable,
          and(
            eq(channelMembers.memberType, "agent"),
            eq(agentsTable.id, channelMembers.memberId),
          ),
        )
        .where(
          and(
            eq(channelMembers.channelId, props.channelId),
            eq(channelMembers.memberType, "agent"),
          ),
        )
        .orderBy(asc(agentName)),
    ),
  );

  const activeRuns = useQuery(() =>
    liveQuery(
      clientDb
        .select({
          id: agentRuns.id,
          agent_id: agentRuns.agentId,
          status: agentRuns.status,
        })
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.channelId, props.channelId),
            eq(agentRuns.status, "running"),
          ),
        )
        .orderBy(desc(agentRuns.startedAt)),
    ),
  );

  const runsByAgent = createMemo(() => {
    const map = new Map<string, AgentRunRow>();
    for (const run of activeRuns().data) {
      // Keep only the most recent run per agent
      if (!map.has(run.agent_id)) {
        map.set(run.agent_id, run);
      }
    }
    return map;
  });

  return (
    <>
      <div class="text-xs font-semibold text-gray-500 uppercase mb-2">
        Agents
      </div>
      <Show when={!agents().isLoading}>
        <For each={agents().data}>
          {(member) => {
            const activeRun = () => runsByAgent().get(member.member_id);
            const isRunning = () => !!activeRun();

            return (
              <div class="flex items-center gap-2 py-1">
                <div
                  onClick={() => props.onAgentClick(member.member_id)}
                  class="flex-1 text-sm text-gray-900 cursor-pointer hover:text-blue-600 hover:underline flex items-center gap-1.5"
                >
                  <Show when={isRunning()}>
                    <span class="inline-block w-3.5 h-3.5 shrink-0">
                      <svg
                        class="animate-spin w-3.5 h-3.5 text-blue-500"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        />
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    </span>
                  </Show>
                  <span class={isRunning() ? "text-blue-600 font-medium" : ""}>
                    {member.name}
                  </span>
                </div>
              </div>
            );
          }}
        </For>
      </Show>
    </>
  );
}
