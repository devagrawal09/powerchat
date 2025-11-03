import { createSignal, Show } from "solid-js";
import { useWatchedQuery } from "~/lib/useWatchedQuery";

type ChannelInviteProps = {
  channelId: string;
};

export function ChannelInvite(props: ChannelInviteProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const channel = useWatchedQuery<{ name: string }>(
    () => `SELECT name FROM channels WHERE id = ?`,
    () => [props.channelId]
  );

  const inviteLink = () =>
    `${window.location.origin}/invite/${props.channelId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        class="w-full mt-4 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-900 rounded flex items-center justify-center gap-2"
      >
        <span>🔗</span>
        Copy Invite Link
      </button>

      <Show when={isOpen()}>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsOpen(false)}
        >
          <div
            class="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              Invite to #{channel.data?.[0]?.name || "channel"}
            </h3>
            <input
              type="text"
              value={inviteLink()}
              readonly
              class="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-gray-50 mb-4"
            />
            <div class="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {copied() ? "Copied!" : "Copy Link"}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                class="px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
