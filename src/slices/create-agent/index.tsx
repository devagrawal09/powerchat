import { createSignal, Show } from "solid-js";
import { writeTransaction } from "~/lib/powersync";
import { useWatchedQuery } from "~/lib/useWatchedQuery";

type CreateAgentProps = {
  channelId: string;
  onSuccess?: () => void;
};

type AgentRow = {
  id: string;
  name: string;
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

  // Query existing agents to check for duplicates
  const existingAgents = useWatchedQuery<AgentRow>(
    () => `SELECT id, name FROM agents`,
    () => []
  );

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const trimmedName = name().trim();
    const trimmedSystemInstructions = systemInstructions().trim();
    const trimmedDescription = description().trim();

    if (!trimmedName || !trimmedSystemInstructions || !trimmedDescription) {
      setMessage({ type: "error", text: "All fields are required" });
      return;
    }

    if (trimmedName.length < 2) {
      setMessage({
        type: "error",
        text: "Agent name must be at least 2 characters",
      });
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
      setMessage({
        type: "error",
        text: "Agent name can only contain letters, numbers, hyphens, and underscores",
      });
      return;
    }

    // Check for duplicate agent name
    const duplicate = (existingAgents.data || []).find(
      (a) => a.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setMessage({ type: "error", text: "Agent name already taken" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const agentId = crypto.randomUUID();
      const now = new Date().toISOString();

      await writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO agents (id, name, system_instructions, description, model_config, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            agentId,
            trimmedName,
            trimmedSystemInstructions,
            trimmedDescription,
            JSON.stringify({}),
            now,
          ]
        );
      });

      setMessage({ type: "success", text: `Agent "${trimmedName}" created!` });
      setName("");
      setSystemInstructions("");
      setDescription("");
      setTimeout(() => {
        setIsOpen(false);
        setMessage(null);
        props.onSuccess?.();
      }, 2000);
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
