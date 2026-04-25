import { asc } from "drizzle-orm";
import { agents, clientDb, liveQuery } from "~/db/client";
import { createSignal, Show } from "solid-js";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";

type CreateAgentProps = {
  channelId: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function CreateAgent(props: CreateAgentProps) {
  const [name, setName] = createSignal("");
  const [systemInstructions, setSystemInstructions] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [message, setMessage] = createSignal<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const existingAgents = useQuery(
    () =>
      liveQuery(
        clientDb
          .select({ id: agents.id, name: agents.name })
          .from(agents)
          .orderBy(asc(agents.name)),
      ),
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

    const duplicate = (existingAgents().data || []).find(
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

      await clientDb.insert(agents).values({
        id: agentId,
        name: trimmedName,
        systemInstructions: trimmedSystemInstructions,
        description: trimmedDescription,
        modelConfig: JSON.stringify({}),
        createdAt: now,
      });

      setMessage({ type: "success", text: `Agent "${trimmedName}" created!` });
      setTimeout(() => {
        props.onClose();
        props.onSuccess?.();
      }, 1500);
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
    <div
      class="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div class="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Create Agent</h3>
          <button
            type="button"
            onClick={props.onClose}
            class="btn-ghost w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. code-reviewer"
              class="input"
              disabled={submitting()}
              autofocus
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">System Instructions</label>
            <textarea
              value={systemInstructions()}
              onInput={(e) => setSystemInstructions(e.currentTarget.value)}
              placeholder="What should this agent do?"
              rows={4}
              class="input resize-none"
              disabled={submitting()}
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="Brief description visible to other agents"
              rows={2}
              class="input resize-none"
              disabled={submitting()}
              required
            />
          </div>

          <Show when={message()}>
            {(msg) => (
              <p
                class={`text-sm ${
                  msg().type === "error" ? "text-red-600" : "text-green-600"
                }`}
              >
                {msg().text}
              </p>
            )}
          </Show>

          <div class="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={
                submitting() ||
                !name().trim() ||
                !systemInstructions().trim() ||
                !description().trim()
              }
              class="btn btn-primary flex-1 py-2.5"
            >
              {submitting() ? "Creating..." : "Create Agent"}
            </button>
            <button
              type="button"
              onClick={props.onClose}
              class="btn btn-secondary px-4 py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
