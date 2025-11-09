import { createSignal, Show } from "solid-js";
import { useAction } from "@solidjs/router";
import { createAgent } from "./action";

type CreateAgentProps = {
  channelId: string;
  onSuccess?: () => void;
};

export function CreateAgent(props: CreateAgentProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [name, setName] = createSignal("");
  const [systemInstructions, setSystemInstructions] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [message, setMessage] = createSignal<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const create = useAction(createAgent);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (
      !name().trim() ||
      !systemInstructions().trim() ||
      !description().trim()
    ) {
      setMessage({ type: "error", text: "All fields are required" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("name", name().trim());
      formData.append("system_instructions", systemInstructions().trim());
      formData.append("description", description().trim());

      const result = await create(formData);

      if (!result) {
        setMessage({ type: "error", text: "No response from server" });
        return;
      }

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else if (result.success) {
        setMessage({ type: "success", text: `Agent "${name()}" created!` });
        setName("");
        setSystemInstructions("");
        setDescription("");
        setTimeout(() => {
          setIsOpen(false);
          setMessage(null);
          props.onSuccess?.();
        }, 2000);
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "Failed to create agent",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="p-4 border-t border-gray-200">
      <Show
        when={isOpen()}
        fallback={
          <button
            onClick={() => setIsOpen(true)}
            class="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Create Agent
          </button>
        }
      >
        <div>
          <h3 class="text-sm font-semibold text-gray-700 mb-2">Create Agent</h3>
          <form onSubmit={handleSubmit} class="space-y-2">
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Agent name"
              class="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 bg-white"
              disabled={submitting()}
              required
            />

            <textarea
              value={systemInstructions()}
              onInput={(e) => setSystemInstructions(e.currentTarget.value)}
              placeholder="System instructions"
              rows={4}
              class="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 bg-white resize-none"
              disabled={submitting()}
              required
            />

            <textarea
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="Description (visible to other agents)"
              rows={2}
              class="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 bg-white resize-none"
              disabled={submitting()}
              required
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

            <div class="flex gap-2">
              <button
                type="submit"
                disabled={
                  submitting() ||
                  !name().trim() ||
                  !systemInstructions().trim() ||
                  !description().trim()
                }
                class="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting() ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setName("");
                  setSystemInstructions("");
                  setDescription("");
                  setMessage(null);
                }}
                class="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </Show>
    </div>
  );
}
