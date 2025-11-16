import { Show } from "solid-js";
import { useParams, useSearchParams } from "@solidjs/router";
import { ChatMessages } from "~/slices/chat-messages";
import { ChatInput } from "~/slices/chat-input";
import { ChannelMemberList } from "~/slices/channel-member-list";
import { ChannelAgentsList } from "~/slices/channel-agents-list";
import { ChannelDocumentsList } from "~/slices/channel-documents-list";
import { DocumentViewer } from "~/slices/document-viewer";
import { AgentViewer } from "~/slices/agent-viewer";
import { ChannelInvite } from "~/slices/channel-invite";
import { ChannelHeader } from "~/slices/channel-header";
import { CreateAgent } from "~/slices/create-agent";

export default function ChannelPage() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const documentId = () => searchParams.doc as string | undefined;
  const agentId = () => searchParams.agent as string | undefined;

  const handleDocumentClick = (docId: string) => {
    setSearchParams({ doc: docId, agent: undefined });
  };

  const handleCloseDocument = () => {
    setSearchParams({ doc: undefined });
  };

  const handleAgentClick = (agentId: string) => {
    setSearchParams({ agent: agentId, doc: undefined });
  };

  const handleCloseAgent = () => {
    setSearchParams({ agent: undefined });
  };

  return (
    <div class="flex-1 flex h-full">
      <div class="flex-1 flex flex-col">
        {/* Header */}
        <ChannelHeader channelId={params.id} />

        <Show
          when={documentId()}
          fallback={
            <Show
              when={agentId()}
              fallback={
                <>
                  <ChatMessages channelId={params.id} />
                  <ChatInput channelId={params.id} />
                </>
              }
            >
              <AgentViewer agentId={agentId()!} onClose={handleCloseAgent} />
            </Show>
          }
        >
          <DocumentViewer
            documentId={documentId()!}
            onClose={handleCloseDocument}
          />
        </Show>
      </div>

      {/* Right sidebar */}
      <div class="w-64 border-l border-gray-200 bg-white flex flex-col">
        <div class="flex-1 overflow-y-auto p-4">
          <ChannelMemberList channelId={params.id} />
          <ChannelAgentsList
            channelId={params.id}
            onAgentClick={handleAgentClick}
          />
          <ChannelDocumentsList
            channelId={params.id}
            onDocumentClick={handleDocumentClick}
          />
        </div>
        <CreateAgent channelId={params.id} />
        <div class="p-4 border-t border-gray-200">
          <ChannelInvite channelId={params.id} />
        </div>
      </div>
    </div>
  );
}
