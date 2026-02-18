import { JSX, Show, createMemo, createSignal } from "solid-js";
import { ChannelList } from "~/slices/channel-list";
import { CreateChannel } from "~/slices/create-channel";
import { UsernameCheck } from "~/slices/username-check";
import { UsernameRegistration } from "~/slices/username-registration";

export default function ChatLayout(props: { children?: JSX.Element }) {
  const usernameCheck = UsernameCheck();
  const [registeredUsername, setRegisteredUsername] = createSignal<
    string | null
  >(null);
  const activeUsername = createMemo(
    () => registeredUsername() ?? usernameCheck.username(),
  );

  const handleUsernameSet = (username: string) => {
    setRegisteredUsername(username);
  };

  return (
    <>
      <Show when={!usernameCheck.checking() && !usernameCheck.hasUsername()}>
        <UsernameRegistration onSuccess={handleUsernameSet} />
      </Show>

      <div class="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <div class="w-64 bg-white border-r border-gray-200 flex flex-col text-gray-900">
          <div class="p-4 border-b border-gray-200">
            <h1 class="text-xl font-bold text-gray-900">PowerChat</h1>
          </div>

          <ChannelList username={activeUsername()} />
          <CreateChannel />
        </div>

        {/* Main content */}
        <div class="flex-1 flex flex-col">{props.children}</div>
      </div>
    </>
  );
}
