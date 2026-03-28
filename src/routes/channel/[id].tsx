import { Show, createEffect } from "solid-js";
import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { ChatMessages } from "~/slices/chat-messages";
import { ChatInput } from "~/slices/chat-input";
import { ChannelMemberList } from "~/slices/channel-member-list";
import { ChannelAgentsList } from "~/slices/channel-agents-list";
import { ChannelDocumentsList } from "~/slices/channel-documents-list";
import { DocumentViewer } from "~/slices/document-viewer";
import { AgentViewer } from "~/slices/agent-viewer";
import { AgentTraceViewer } from "~/slices/agent-trace-viewer";
import { ChannelInvite } from "~/slices/channel-invite";
import { ChannelHeader } from "~/slices/channel-header";
import { CreateAgent } from "~/slices/create-agent";
import { useQuery } from "~/lib/powersync-solid";

export default function ChannelPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filePath = () => searchParams.doc as string | undefined;
  const agentId = () => searchParams.agent as string | undefined;
  const traceRunId = () => searchParams.trace as string | undefined;

  const channel = useQuery<{ id: string }>(
    () => `SELECT id FROM channels WHERE id = ?`,
    () => [params.id],
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

  return (
    <Show when={params.id}>
      {(channelId) => (
        <div class="flex-1 flex h-full">
          <div class="flex-1 flex flex-col">
            {/* Header */}
            <ChannelHeader channelId={channelId()} />

            <Show
              when={filePath()}
              fallback={
                <Show
                  when={agentId()}
                  fallback={
                    <Show
                      when={traceRunId()}
                      fallback={
                        <>
                          <ChatMessages channelId={channelId()} />
                          <ChatInput channelId={channelId()} />
                        </>
                      }
                    >
                      <AgentTraceViewer
                        runId={traceRunId()!}
                        onClose={handleCloseTrace}
                      />
                    </Show>
                  }
                >
                  <AgentViewer
                    agentId={agentId()!}
                    onClose={handleCloseAgent}
                  />
                </Show>
              }
            >
              <DocumentViewer
                channelId={channelId()}
                filePath={filePath()!}
                onClose={handleCloseDocument}
              />
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
              <ChannelDocumentsList
                channelId={channelId()}
                onFileClick={handleDocumentClick}
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
