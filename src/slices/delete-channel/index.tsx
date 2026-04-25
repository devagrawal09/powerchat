import { eq } from "drizzle-orm";
import { createSignal, Show } from "solid-js";
import { channels, clientDb } from "~/db/client";
import { useNavigate } from "@solidjs/router";

type DeleteChannelProps = {
  channelId: string;
  channelName?: string;
  onDelete?: () => void;
};

export function DeleteChannel(props: DeleteChannelProps) {
  const [confirming, setConfirming] = createSignal(false);
  const navigate = useNavigate();

  const handleDelete = async () => {
    await clientDb.delete(channels).where(eq(channels.id, props.channelId));
    setConfirming(false);
    props.onDelete?.();
    navigate("/");
  };

  return (
    <div class="relative">
      <button
        type="button"
        class="ml-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setConfirming(true);
        }}
        aria-label="Delete channel"
      >
        &times;
      </button>

      <Show when={confirming()}>
        {/* Backdrop to close on outside click */}
        <div
          class="fixed inset-0 z-40"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(false);
          }}
        />
        {/* Popover */}
        <div
          class="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <p class="text-sm text-gray-700 mb-3">
            Delete <span class="font-semibold">#{props.channelName || "channel"}</span>? This can't be undone.
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              class="btn btn-danger flex-1 py-1.5 text-xs"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(false);
              }}
              class="btn btn-secondary flex-1 py-1.5 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
