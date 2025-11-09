import {} from "solid-js";
import { useParams } from "@solidjs/router";
import { ChatMessages } from "~/slices/chat-messages";
import { ChatInput } from "~/slices/chat-input";
import { ChannelMemberList } from "~/slices/channel-member-list";
import { ChannelInvite } from "~/slices/channel-invite";
import { ChannelHeader } from "~/slices/channel-header";
import { CreateAgent } from "~/slices/create-agent";

export default function ChannelPage() {
  const params = useParams();

  return (
    <div class="flex-1 flex h-full">
      <div class="flex-1 flex flex-col">
        {/* Header */}
        <ChannelHeader channelId={params.id} />

        <ChatMessages channelId={params.id} />
        <ChatInput channelId={params.id} />
      </div>

      {/* Right sidebar */}
      <div class="w-64 border-l border-gray-200 bg-white flex flex-col">
        <div class="flex-1 overflow-y-auto">
          <ChannelMemberList channelId={params.id} />
        </div>
        <CreateAgent channelId={params.id} />
        <div class="p-4 border-t border-gray-200">
          <ChannelInvite channelId={params.id} />
        </div>
      </div>
    </div>
  );
}
