import { eq } from "drizzle-orm";
import { agentRuns, agents, clientDb, liveQuery } from "~/db/client";
import { Show, createEffect, createMemo } from "solid-js";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";
import { RenderMarkdown } from "~/components/Markdown";
import { stopAgent } from "~/server/stop-agent";

type AgentTraceViewerProps = {
  runId: string;
  onClose: () => void;
};

export function AgentTraceViewer(props: AgentTraceViewerProps) {
  let scrollContainer: HTMLDivElement | undefined;

  const run = useQuery(() =>
    liveQuery(
      clientDb
        .select({
          id: agentRuns.id,
          channel_id: agentRuns.channelId,
          agent_id: agentRuns.agentId,
          agent_message_id: agentRuns.agentMessageId,
          status: agentRuns.status,
          trace: agentRuns.trace,
          error: agentRuns.error,
          started_at: agentRuns.startedAt,
          completed_at: agentRuns.completedAt,
        })
        .from(agentRuns)
        .where(eq(agentRuns.id, props.runId)),
    ),
  );

  const agentId = createMemo(() => run().data[0]?.agent_id);

  const agent = useQuery(() =>
    liveQuery(
      clientDb
        .select({ name: agents.name })
        .from(agents)
        .where(eq(agents.id, agentId() ?? "__missing__")),
    ),
  );

  const agentName = () => agent().data[0]?.name || "Agent";
  const runData = () => run().data[0];
  const isRunning = () => runData()?.status === "running";
  const traceContent = () => runData()?.trace || "";

  // Auto-scroll to bottom when trace updates
  createEffect(() => {
    traceContent();
    if (scrollContainer) {
      setTimeout(() => {
        scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
      }, 0);
    }
  });

  const handleStop = async () => {
    await stopAgent(props.runId);
  };

  const statusLabel = () => {
    const s = runData()?.status;
    switch (s) {
      case "running":
        return "Running";
      case "completed":
        return "Completed";
      case "error":
        return "Error";
      case "stopped":
        return "Stopped";
      default:
        return s || "Unknown";
    }
  };

  const statusColor = () => {
    const s = runData()?.status;
    switch (s) {
      case "running":
        return "text-blue-600 bg-blue-50";
      case "completed":
        return "text-green-600 bg-green-50";
      case "error":
        return "text-red-600 bg-red-50";
      case "stopped":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div class="flex-1 flex flex-col h-full">
      {/* Header */}
      <div class="border-b border-gray-200 bg-white p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold text-gray-900">
            {agentName()} — Trace
          </h2>
          <span
            class={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor()}`}
          >
            <Show when={isRunning()}>
              <svg
                class="animate-spin inline-block w-3 h-3 mr-1"
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
            </Show>
            {statusLabel()}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <Show when={isRunning()}>
            <button
              onClick={handleStop}
              class="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded hover:bg-red-100"
            >
              Stop
            </button>
          </Show>
          <button
            onClick={props.onClose}
            class="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>

      {/* Trace content */}
      <div ref={scrollContainer} class="flex-1 overflow-y-auto p-4 bg-gray-50">
        <Show
          when={traceContent()}
          fallback={
            <div class="text-sm text-gray-500 flex items-center gap-2">
              <Show when={isRunning()}>
                <svg
                  class="animate-spin w-4 h-4 text-blue-500"
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
              </Show>
              {isRunning() ? "Agent is thinking..." : "No trace data"}
            </div>
          }
        >
          <div class="max-w-4xl mx-auto">
            <div class="text-sm text-gray-900">
              <RenderMarkdown>{traceContent()}</RenderMarkdown>
            </div>
          </div>
        </Show>

        {/* Error display */}
        <Show when={runData()?.error}>
          <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <strong>Error:</strong> {runData()!.error}
          </div>
        </Show>

        {/* Timestamps */}
        <Show when={runData()}>
          <div class="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400 space-y-1">
            <div>
              Started: {new Date(runData()!.started_at).toLocaleString()}
            </div>
            <Show when={runData()!.completed_at}>
              <div>
                Completed: {new Date(runData()!.completed_at!).toLocaleString()}
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
