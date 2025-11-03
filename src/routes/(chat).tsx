import { JSX } from "solid-js";
import { ChannelList } from "~/slices/channel-list";
import { CreateChannel } from "~/slices/create-channel";
import { DevDbInspector } from "~/slices/dev-db-inspector";

export default function ChatLayout(props: { children?: JSX.Element }) {
  return (
    <div class="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div class="w-64 bg-white border-r border-gray-200 flex flex-col text-gray-900">
        <div class="p-4 border-b border-gray-200">
          <h1 class="text-xl font-bold text-gray-900">PowerChat</h1>
        </div>

        <ChannelList />
        <CreateChannel />
      </div>

      {/* Main content */}
      <div class="flex-1 flex flex-col">
        {props.children}
        <DevDbInspector />
      </div>
    </div>
  );
}
