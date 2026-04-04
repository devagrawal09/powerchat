import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { channelMembers, channels, clientDb } from "~/db/client";
import { getUsername } from "~/lib/getUsername";

export function CreateChannel() {
  const navigate = useNavigate();
  const [creating, setCreating] = createSignal(false);

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
      navigate(`/channel/${channelId}`);
    } catch (err) {
      console.error("Failed to create channel", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div class="p-4 border-t border-gray-200">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="New channel name"
          class="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 bg-white"
          required
          minLength={2}
        />
        <button
          type="submit"
          disabled={creating()}
          class="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {creating() ? "Creating..." : "Create Channel"}
        </button>
      </form>
    </div>
  );
}
