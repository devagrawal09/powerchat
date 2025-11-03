import { createSignal } from "solid-js";
import { writeTransaction } from "~/lib/powersync";
import { getUserId } from "~/lib/getUserId";

export function CreateChannel() {
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
      const userId = getUserId();

      await writeTransaction(async (tx) => {
        // Ensure user exists
        const existingUser = await tx.execute(
          `SELECT id FROM users WHERE id = ?`,
          [userId]
        );
        if (!existingUser.rows?._array?.length) {
          await tx.execute(
            `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, datetime('now'))`,
            [userId, "Anonymous"]
          );
        }

        // Insert channel
        await tx.execute(
          `INSERT INTO channels (id, name, created_by, created_at) VALUES (?, ?, ?, datetime('now'))`,
          [channelId, name, userId]
        );

        // Add user as member
        await tx.execute(
          `INSERT INTO channel_members (id, channel_id, member_type, member_id, joined_at) VALUES (?, ?, 'user', ?, datetime('now'))`,
          [crypto.randomUUID(), channelId, userId]
        );

        // Auto-add assistant agent
        await tx.execute(
          `INSERT INTO channel_members (id, channel_id, member_type, member_id, joined_at) VALUES (?, ?, 'agent', ?, datetime('now'))`,
          [
            crypto.randomUUID(),
            channelId,
            "00000000-0000-0000-0000-000000000001",
          ]
        );
      });

      form.reset();
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
