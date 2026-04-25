import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { channelMembers, channels, clientDb } from "~/db/client";
import { getUsername } from "~/lib/getUsername";

export function CreateChannel(props: { onCreated: () => void }) {
  const navigate = useNavigate();
  const [creating, setCreating] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();

    if (!name || name.length < 2) return;

    setCreating(true);
    try {
      const channelId = crypto.randomUUID();
      const username = getUsername();

      if (!username) {
        console.error("No username found");
        setCreating(false);
        return;
      }

      const now = new Date().toISOString();

      await clientDb.transaction(async (tx) => {
        await tx.insert(channels).values({
          id: channelId,
          name,
          createdBy: username,
          createdAt: now,
        });

        await tx.insert(channelMembers).values({
          id: crypto.randomUUID(),
          channelId,
          memberType: "user",
          memberId: username,
          joinedAt: now,
        });

        await tx.insert(channelMembers).values({
          id: crypto.randomUUID(),
          channelId,
          memberType: "agent",
          memberId: "00000000-0000-0000-0000-000000000001",
          joinedAt: now,
        });
      });

      form.reset();
      props.onCreated();
      navigate(`/channel/${channelId}`);
    } catch (err) {
      console.error("Failed to create channel", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Header row with + button — rendered by parent, but we export the toggle */}
      <div class="px-2 pb-2">
        <form onSubmit={handleSubmit} class="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            name="name"
            placeholder="Channel name"
            class="input text-sm py-1.5"
            required
            minLength={2}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                props.onCreated();
              }
            }}
          />
          <button
            type="submit"
            disabled={creating()}
            class="btn btn-primary px-3 py-1.5 text-sm shrink-0"
          >
            {creating() ? "..." : "Add"}
          </button>
        </form>
      </div>
    </>
  );
}

// Expose a wrapper that includes the header label + toggle button
export function ChannelListHeader(props: { onAdd: () => void }) {
  return (
    <div class="flex items-center justify-between px-2 mb-2">
      <span class="text-xs font-semibold text-gray-500 uppercase">
        Channels
      </span>
      <button
        type="button"
        onClick={props.onAdd}
        class="btn-ghost w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Create channel"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line x1="7" y1="2" x2="7" y2="12" />
          <line x1="2" y1="7" x2="12" y2="7" />
        </svg>
      </button>
    </div>
  );
}
