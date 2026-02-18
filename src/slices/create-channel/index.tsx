import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { getUsername } from "~/lib/getUsername";
import {
  channelMembersCollection,
  channelsCollection,
  ensureTanStackDbReady,
} from "~/lib/tanstack-db";

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
      const now = new Date().toISOString();

      if (!username) {
        console.error("No username found");
        setCreating(false);
        return;
      }

      await ensureTanStackDbReady();

      await channelsCollection
        .insert({
          id: channelId,
          name,
          created_by: username,
          created_at: now,
        })
        .isPersisted.promise;

      await channelMembersCollection
        .insert({
          id: crypto.randomUUID(),
          channel_id: channelId,
          member_type: "user",
          member_id: username,
          joined_at: now,
        })
        .isPersisted.promise;

      await channelMembersCollection
        .insert({
          id: crypto.randomUUID(),
          channel_id: channelId,
          member_type: "agent",
          member_id: "00000000-0000-0000-0000-000000000001",
          joined_at: now,
        })
        .isPersisted.promise;

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
