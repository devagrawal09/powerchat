import { Show } from "solid-js";
import { useWatchedQuery } from "~/lib/useWatchedQuery";
import { RenderMarkdown } from "~/components/Markdown";

type AgentRow = {
  id: string;
  name: string;
  description: string;
  system_instructions: string;
};

type AgentViewerProps = {
  agentId: string;
  onClose: () => void;
};

export function AgentViewer(props: AgentViewerProps) {
  const agent = useWatchedQuery<AgentRow>(
    () =>
      `SELECT id, name, description, system_instructions 
       FROM agents 
       WHERE id = ?`,
    () => [props.agentId]
  );

  return (
    <div class="flex-1 flex flex-col h-full">
      {/* Header with name and close button */}
      <div class="border-b border-gray-200 bg-white p-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">
          {agent.data[0]?.name || "Agent"}
        </h2>
        <button
          onClick={props.onClose}
          class="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
        >
          Close
        </button>
      </div>

      {/* Agent content */}
      <div class="flex-1 overflow-y-auto p-4 bg-gray-50">
        <Show when={agent.data.length > 0}>
          <div class="max-w-4xl mx-auto">
            {/* Description */}
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-gray-700 mb-2">
                Description
              </h3>
              <p class="text-sm text-gray-600">{agent.data[0].description}</p>
            </div>

            {/* System Instructions */}
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-gray-700 mb-2">
                System Instructions
              </h3>
              <div class="prose prose-sm max-w-none text-gray-900">
                <RenderMarkdown>
                  {agent.data[0].system_instructions}
                </RenderMarkdown>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
