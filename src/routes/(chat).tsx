import { JSX, Show } from "solid-js";
import { ChannelList } from "~/slices/channel-list";
import { UsernameCheck } from "~/slices/username-check";
import { UsernameRegistration } from "~/slices/username-registration";
import { useSession } from "~/lib/session";

export default function ChatLayout(props: { children?: JSX.Element }) {
  const usernameCheck = UsernameCheck();
  const session = useSession();

  const handleUsernameSet = (username: string) => {
    // Cookie is set by mutation slice, query slice will detect it
  };

  const handleSignOut = () => {
    session.setUsername(null);
    window.location.reload();
  };

  return (
    <>
      <Show when={!usernameCheck.checking() && !usernameCheck.hasUsername()}>
        <UsernameRegistration onSuccess={handleUsernameSet} />
      </Show>

      <div class="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <div class="w-64 bg-white border-r border-gray-200 flex flex-col text-gray-900">
          <div class="h-12 px-4 flex items-center border-b border-gray-200 shrink-0">
            <h1 class="text-xl font-bold text-gray-900">PowerChat</h1>
          </div>

          <ChannelList />

          {/* User identity chip */}
          <Show when={session.username()}>
            {(username) => (
              <div class="px-4 py-3 border-t border-gray-200 shrink-0 flex items-center">
                <div class="group relative flex items-center gap-2.5 w-full">
                  <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {username()[0]?.toUpperCase()}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900 truncate">
                      {username()}
                    </div>
                    <div class="text-xs text-gray-400">Online</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    class="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400 hover:text-red-600"
                    title="Sign out"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 14H3.33C2.6 14 2 13.4 2 12.67V3.33C2 2.6 2.6 2 3.33 2H6" />
                      <polyline points="10.67 11.33 14 8 10.67 4.67" />
                      <line x1="14" y1="8" x2="6" y2="8" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </Show>
        </div>

        {/* Main content */}
        <div class="flex-1 flex flex-col">{props.children}</div>
      </div>
    </>
  );
}
