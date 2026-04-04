import { eq } from "drizzle-orm";
import { channels, clientDb, liveQuery } from "~/db/client";
import { Show, createEffect } from "solid-js";
import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { ChannelMemberList } from "~/slices/channel-member-list";
import { ChannelAgentsList } from "~/slices/channel-agents-list";
import { ChannelInvite } from "~/slices/channel-invite";
import { ChannelHeader } from "~/slices/channel-header";
import { CreateAgent } from "~/slices/create-agent";
import { ChatMessages } from "~/slices/chat-messages";
import { ChatInput } from "~/slices/chat-input";
import { AgentViewer } from "~/slices/agent-viewer";
import { AgentTraceViewer } from "~/slices/agent-trace-viewer";
import { useQuery } from "~/lib/powersync-solid";

export default function ChannelPage() {
  const params = useParams();
  const channelIdParam = () => params.id ?? "";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filePath = () => searchParams.doc as string | undefined;
  const agentId = () => searchParams.agent as string | undefined;
  const traceRunId = () => searchParams.trace as string | undefined;

  const channel = useQuery(
    () =>
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

  const handleDocumentClick = (docId: string) => {
    setSearchParams({ doc: docId, agent: undefined, trace: undefined });
  };

  const handleCloseDocument = () => {
    setSearchParams({ doc: undefined });
  };

  const handleAgentClick = (agentId: string) => {
    setSearchParams({ agent: agentId, doc: undefined, trace: undefined });
  };

  const handleCloseAgent = () => {
    setSearchParams({ agent: undefined });
  };

  const handleTraceClick = (runId: string) => {
    setSearchParams({ trace: runId, doc: undefined, agent: undefined });
  };

  const handleCloseTrace = () => {
    setSearchParams({ trace: undefined });
  };

  const activePanel = () => {
    if (traceRunId()) return "trace";
    if (agentId()) return "agent";
    return "chat";
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
                <ChatInput channelId={channelId()} channelName={filePath()} />
              </div>
            </div>

            <Show when={activePanel() !== "chat"}>
              <div class="w-96 border-l border-gray-200 bg-white min-w-0">
                <Show when={activePanel() === "agent" && agentId()}>
                  {(id) => (
                    <AgentViewer agentId={id()} onClose={handleCloseAgent} />
                  )}
                </Show>

                <Show when={activePanel() === "trace" && traceRunId()}>
                  {(runId) => (
                    <AgentTraceViewer
                      runId={runId()}
                      onClose={handleCloseTrace}
                    />
                  )}
                </Show>
              </div>
            </Show>
          </div>

          {/* Right sidebar */}
          <div class="w-64 border-l border-gray-200 bg-white flex flex-col">
            <div class="flex-1 overflow-y-auto p-4">
              <ChannelMemberList channelId={channelId()} />
              <ChannelAgentsList
                channelId={channelId()}
                onAgentClick={handleAgentClick}
                onTraceClick={handleTraceClick}
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
