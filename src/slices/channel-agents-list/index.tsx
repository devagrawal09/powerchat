import { For, Show, createMemo } from "solid-js";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";
import { stopAgent } from "~/server/stop-agent";

type MemberRow = {
  member_type: "agent";
  member_id: string;
  name: string | null;
};

type AgentRunRow = {
  id: string;
  agent_id: string;
  status: string;
};

type ChannelAgentsListProps = {
  channelId: string;
  onAgentClick: (agentId: string) => void;
  onTraceClick: (runId: string) => void;
};

export function ChannelAgentsList(props: ChannelAgentsListProps) {
  // Agents in channel
  const agents = useQuery<MemberRow>(
    () =>
      `SELECT 'agent' as member_type, cm.member_id as member_id,
              COALESCE(a.name, 'Agent') as name
       FROM channel_members cm
       LEFT JOIN agents a ON cm.member_type = 'agent' AND a.id = cm.member_id
       WHERE cm.channel_id = ? AND cm.member_type = 'agent'
       ORDER BY name`,
    () => [props.channelId],
  );

  // Active agent runs in this channel
  const activeRuns = useQuery<AgentRunRow>(
    () =>
      `SELECT id, agent_id, status
       FROM agent_runs
       WHERE channel_id = ? AND status = 'running'
       ORDER BY started_at DESC`,
    () => [props.channelId],
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

  const handleStop = async (e: MouseEvent, runId: string) => {
    e.stopPropagation();
    e.preventDefault();
    await stopAgent(runId);
  };

  return (
    <>
      <div class="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">
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
                  onClick={() => {
                    const run = activeRun();
                    if (run) {
                      props.onTraceClick(run.id);
                    } else {
                      props.onAgentClick(member.member_id);
                    }
                  }}
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
                <Show when={isRunning()}>
                  <button
                    type="button"
                    onClick={(e) => handleStop(e, activeRun()!.id)}
                    class="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200 shrink-0"
                    title="Stop agent"
                  >
                    Stop
                  </button>
                </Show>
              </div>
            );
          }}
        </For>
      </Show>
    </>
  );
}
