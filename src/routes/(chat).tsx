import { For, Show, Suspense, createSignal, JSX } from "solid-js";
import { A } from "@solidjs/router";
import { useWatchedQuery } from "~/lib/useWatchedQuery";
import { writeTransaction } from "~/lib/powersync";
import { getUserId } from "~/lib/getUserId";

type ChannelRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export default function ChatLayout(props: { children?: JSX.Element }) {
  // Watch channels from PowerSync local DB
  const channels = useWatchedQuery<ChannelRow>(
    () =>
      `SELECT c.* FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id
       WHERE cm.member_type = 'user'
       ORDER BY c.created_at DESC`
  );

  const [creating, setCreating] = createSignal(false);

  const handleCreateChannel = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    if (!name) return;

    setCreating(true);
    try {
      const channelId = crypto.randomUUID();
      const userId = getUserId();

      await writeTransaction(async (tx) => {
        // Ensure user exists first
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

        // Insert channel membership
        await tx.execute(
          `INSERT INTO channel_members (id, channel_id, member_type, member_id, joined_at) VALUES (?, ?, 'user', ?, datetime('now'))`,
          [crypto.randomUUID(), channelId, userId]
        );

        // Auto-add default assistant agent
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
    <div class="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div class="w-64 bg-white border-r border-gray-200 flex flex-col text-gray-900">
        <div class="p-4 border-b border-gray-200">
          <h1 class="text-xl font-bold text-gray-900">PowerChat</h1>
        </div>

        {/* Channels list */}
        <div class="flex-1 overflow-y-auto p-2">
          <div class="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">
            Channels
          </div>
          <Suspense
            fallback={<div class="px-2 text-sm text-gray-500">Loading...</div>}
          >
            <Show when={!channels.loading}>
              <For each={channels.data}>
                {(channel) => (
                  <div class="flex items-center group">
                    <A
                      href={`/channel/${channel.id}`}
                      class="flex-1 px-2 py-1.5 rounded hover:bg-gray-100 text-sm text-gray-900"
                      activeClass="bg-blue-50 text-blue-600"
                    >
                      # {channel.name}
                    </A>
                    <button
                      type="button"
                      class="ml-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100"
                      onClick={async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        await writeTransaction(async (tx) => {
                          await tx.execute(
                            "DELETE FROM channels WHERE id = ?",
                            [channel.id]
                          );
                        });
                      }}
                      aria-label="Delete channel"
                    >
                      ×
                    </button>
                  </div>
                )}
              </For>
            </Show>
          </Suspense>
        </div>

        {/* Create channel form */}
        <div class="p-4 border-t border-gray-200">
          <form onSubmit={handleCreateChannel}>
            <input
              type="text"
              name="name"
              placeholder="New channel name"
              class="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 bg-white"
              required
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
      </div>

      {/* Main content */}
      <div class="flex-1 flex flex-col">{props.children}</div>
    </div>
  );
}
