import { Component, createResource, For, Show, Suspense } from "solid-js";
import { A, useAction, useSubmission } from "@solidjs/router";
import { getPowerSync } from "~/lib/powersync";
import { createChannel } from "~/server/actions";

export default function ChatLayout(props: any) {
  // Query channels from PowerSync local DB
  const [channels] = createResource(async () => {
    const db = await getPowerSync();
    const result = await db.execute(
      `SELECT c.* FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id
       WHERE cm.member_type = 'user'
       ORDER BY c.created_at DESC`
    );
    return result.rows?._array || [];
  });

  const createChannelAction = useAction(createChannel);
  const submission = useSubmission(createChannel);

  const handleCreateChannel = (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    createChannelAction(formData);
    form.reset();
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
            <Show when={channels()}>
              <For each={channels()}>
                {(channel: any) => (
                  <A
                    href={`/channel/${channel.id}`}
                    class="block px-2 py-1.5 rounded hover:bg-gray-100 text-sm text-gray-900"
                    activeClass="bg-blue-50 text-blue-600"
                  >
                    # {channel.name}
                  </A>
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
              disabled={submission.pending}
              class="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submission.pending ? "Creating..." : "Create Channel"}
            </button>
          </form>
        </div>
      </div>

      {/* Main content */}
      <div class="flex-1 flex flex-col">{props.children}</div>
    </div>
  );
}
