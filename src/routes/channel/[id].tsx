import { useNavigate, useParams } from "@solidjs/router";
import { eq } from "drizzle-orm";
import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  For,
  startTransition,
} from "solid-js";
import { channels, clientDb, liveQuery } from "~/db/client";
import { useQuery } from "~/lib/powersync-solid";
import { AgentViewer } from "~/slices/agent-viewer";
import { ChannelAgentsList } from "~/slices/channel-agents-list";
import { ChannelHeader } from "~/slices/channel-header";
import { ChannelInvite } from "~/slices/channel-invite";
import { ChannelMemberList } from "~/slices/channel-member-list";
import { ChannelWorkspaceTree } from "~/slices/channel-workspace-tree";
import { ChatInput } from "~/slices/chat-input";
import { ChatMessages } from "~/slices/chat-messages";
import { CreateAgent } from "~/slices/create-agent";
import { WorkspaceFileViewer } from "~/slices/workspace-file-viewer";
import type { WorkspaceFileSelection } from "~/lib/workspace-file-viewability";

type ChannelInspectorState =
  | {
      kind: "agent";
      agentId: string;
    }
  | {
      kind: "file";
      file: WorkspaceFileSelection;
    }
  | null;

type RightTab = "members" | "agents" | "workspace";

export default function ChannelPage() {
  const params = useParams();
  const channelIdParam = () => params.id ?? "";
  const navigate = useNavigate();
  const [selectedInspector, setSelectedInspector] =
    createSignal<ChannelInspectorState>(null);
  const [activeTab, setActiveTab] = createSignal<RightTab>("members");
  const [showCreateAgent, setShowCreateAgent] = createSignal(false);

  const channel = useQuery(() =>
    liveQuery(
      clientDb
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.id, channelIdParam())),
    ),
  );

  createEffect(() => {
    console.log({ data: channel().data, loading: channel().isLoading });
    if (!channel().isLoading && channel().data.length === 0) {
      console.log("Channel not found");
      navigate("/", { replace: true });
    }
  });

  const handleAgentClick = (agentId: string) => {
    startTransition(() =>
      setSelectedInspector({
        kind: "agent",
        agentId,
      }),
    );
  };

  const handleWorkspaceFileSelect = (file: WorkspaceFileSelection) => {
    startTransition(() =>
      setSelectedInspector({
        kind: "file",
        file,
      }),
    );
  };

  const selectedAgentId = () => {
    const inspector = selectedInspector();
    return inspector?.kind === "agent" ? inspector.agentId : null;
  };

  const selectedFilePath = () => {
    const inspector = selectedInspector();
    return inspector?.kind === "file" ? inspector.file.path : null;
  };

  const handleCloseInspector = () => {
    setSelectedInspector(null);
  };

  const tabs: { id: RightTab; label: string }[] = [
    { id: "members", label: "Members" },
    { id: "agents", label: "Agents" },
    { id: "workspace", label: "Workspace" },
  ];

  return (
    <Show when={params.id}>
      {(channelId) => (
        <div class="flex-1 flex h-full overflow-hidden">
          <div class="flex-1 flex min-w-0 overflow-hidden">
            <div class="flex-1 flex flex-col min-w-0">
              <ChannelHeader channelId={channelId()} />

              <div class="flex-1 flex flex-col min-h-0">
                <ChatMessages channelId={channelId()} />
                <ChatInput channelId={channelId()} />
              </div>
            </div>

            <Show when={selectedInspector()}>
              <div class="w-96 border-l border-gray-200 bg-white min-w-0">
                <Switch>
                  <Match when={selectedAgentId()}>
                    {(agentId) => (
                      <AgentViewer
                        agentId={agentId()}
                        onClose={handleCloseInspector}
                      />
                    )}
                  </Match>
                  <Match when={selectedFilePath()}>
                    {(filePath) => (
                      <WorkspaceFileViewer
                        channelId={channelId()}
                        filePath={filePath()}
                        onClose={handleCloseInspector}
                      />
                    )}
                  </Match>
                </Switch>
              </div>
            </Show>
          </div>

          {/* Right sidebar with tabs */}
          <div class="w-64 border-l border-gray-200 bg-white flex flex-col">
            {/* Tab bar */}
            <div class="h-12 flex items-end border-b border-gray-200 shrink-0">
              <For each={tabs}>
                {(tab) => (
                  <button
                    type="button"
                    onClick={() => startTransition(() => setActiveTab(tab.id))}
                    class={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors relative ${
                      activeTab() === tab.id
                        ? "text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.label}
                    <Show when={activeTab() === tab.id}>
                      <div class="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                    </Show>
                  </button>
                )}
              </For>
            </div>

            {/* Tab content */}
            <div class="flex-1 overflow-y-auto p-4">
              <Show when={activeTab() === "members"}>
                <ChannelMemberList channelId={channelId()} />
                <div class="mt-4 pt-4 border-t border-gray-100">
                  <ChannelInvite channelId={channelId()} />
                </div>
              </Show>

              <Show when={activeTab() === "agents"}>
                <ChannelAgentsList
                  channelId={channelId()}
                  onAgentClick={handleAgentClick}
                />
                <div class="mt-4 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateAgent(true)}
                    class="btn btn-primary w-full py-2"
                  >
                    Create Agent
                  </button>
                </div>
              </Show>

              <Show when={activeTab() === "workspace"}>
                <ChannelWorkspaceTree
                  channelId={channelId()}
                  onFileSelect={handleWorkspaceFileSelect}
                />
              </Show>
            </div>
          </div>

          {/* Create Agent Modal */}
          <Show when={showCreateAgent()}>
            <CreateAgent
              channelId={channelId()}
              onClose={() => setShowCreateAgent(false)}
            />
          </Show>
        </div>
      )}
    </Show>
  );
}
