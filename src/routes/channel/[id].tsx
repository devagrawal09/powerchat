import { useNavigate, useParams } from "@solidjs/router";
import { eq } from "drizzle-orm";
import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
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

export default function ChannelPage() {
  const params = useParams();
  const channelIdParam = () => params.id ?? "";
  const navigate = useNavigate();
  const [selectedInspector, setSelectedInspector] =
    createSignal<ChannelInspectorState>(null);

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
    setSelectedInspector({
      kind: "agent",
      agentId,
    });
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

  return (
    <Show when={params.id}>
      {(channelId) => (
        <div class="flex-1 flex h-full">
          <div class="flex-1 flex min-w-0">
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

          <div class="w-64 border-l border-gray-200 bg-white flex flex-col">
            <div class="flex-1 overflow-y-auto p-4">
              <ChannelMemberList channelId={channelId()} />
              <ChannelAgentsList
                channelId={channelId()}
                onAgentClick={handleAgentClick}
              />
              <ChannelWorkspaceTree
                channelId={channelId()}
                onFileSelect={handleWorkspaceFileSelect}
              />
            </div>
            <CreateAgent channelId={channelId()} />
            <div class="p-4 border-t border-gray-200">
              <ChannelInvite channelId={channelId()} />
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
