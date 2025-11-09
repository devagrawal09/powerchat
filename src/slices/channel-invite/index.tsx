import { createSignal, Show } from "solid-js";
import { useAction } from "@solidjs/router";
import { inviteByUsername } from "~/server/actions";

type ChannelInviteProps = {
  channelId: string;
};

export function ChannelInvite(props: ChannelInviteProps) {
  const [username, setUsername] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [message, setMessage] = createSignal<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const invite = useAction(inviteByUsername);

  const handleInvite = async (e: Event) => {
    e.preventDefault();
    const value = username().trim();

    if (!value) {
      setMessage({ type: "error", text: "Please enter a username" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("channelId", props.channelId);
      formData.append("username", value);

      const result = await invite(formData);

      if (!result) {
        setMessage({ type: "error", text: "No response from server" });
        return;
      }

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else if (result.success) {
        setMessage({ type: "success", text: `${value} added to channel!` });
        setUsername("");
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "Failed to invite user",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="p-4 border-t border-gray-200">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">
        Invite by Username
      </h3>
      <form onSubmit={handleInvite} class="space-y-2">
        <input
          type="text"
          value={username()}
          onInput={(e) => setUsername(e.currentTarget.value)}
          placeholder="Enter username"
          class="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 bg-white"
          disabled={submitting()}
        />

        <Show when={message()}>
          {(msg) => (
            <p
              class={`text-xs ${
                msg().type === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {msg().text}
            </p>
          )}
        </Show>

        <button
          type="submit"
          disabled={submitting() || !username().trim()}
          class="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting() ? "Adding..." : "Add User"}
        </button>
      </form>
    </div>
  );
}
