import { createEffect, Show } from "solid-js";
import { useWatchedQuery } from "~/lib/useWatchedQuery";

export function DevDbInspector() {
  // Watch all key tables
  const users = useWatchedQuery<{ id: string; display_name: string }>(
    () => `SELECT * FROM users ORDER BY created_at DESC`
  );
  const agents = useWatchedQuery<{ id: string; name: string }>(
    () => `SELECT * FROM agents ORDER BY created_at DESC`
  );
  const channels = useWatchedQuery<{ id: string; name: string }>(
    () => `SELECT * FROM channels ORDER BY created_at DESC`
  );
  const channelMembers = useWatchedQuery<{
    id: string;
    channel_id: string;
    member_type: string;
    member_id: string;
  }>(() => `SELECT * FROM channel_members ORDER BY joined_at DESC`);
  const messages = useWatchedQuery<{
    id: string;
    channel_id: string;
    author_type: string;
    author_id: string;
    content: string;
    created_at: string;
  }>(() => `SELECT * FROM messages ORDER BY created_at DESC, id DESC`);
  const messageMentions = useWatchedQuery<{
    id: string;
    message_id: string;
    agent_id: string;
  }>(() => `SELECT * FROM message_mentions ORDER BY id DESC`);

  // Log on any change
  createEffect(() => {
    console.groupCollapsed("[DB] users (", users.data.length, ")");
    console.log(JSON.stringify(users.data, null, 2));
    console.groupEnd();
  });
  createEffect(() => {
    console.groupCollapsed("[DB] agents (", agents.data.length, ")");
    console.log(JSON.stringify(agents.data, null, 2));
    console.groupEnd();
  });
  createEffect(() => {
    console.groupCollapsed("[DB] channels (", channels.data.length, ")");
    console.log(JSON.stringify(channels.data, null, 2));
    console.groupEnd();
  });
  createEffect(() => {
    console.groupCollapsed(
      "[DB] channel_members (",
      channelMembers.data.length,
      ")"
    );
    console.log(JSON.stringify(channelMembers.data, null, 2));
    console.groupEnd();
  });
  createEffect(() => {
    console.groupCollapsed("[DB] messages (", messages.data.length, ")");
    console.log(JSON.stringify(messages.data, null, 2));
    console.groupEnd();
  });
  createEffect(() => {
    console.groupCollapsed(
      "[DB] message_mentions (",
      messageMentions.data.length,
      ")"
    );
    console.log(JSON.stringify(messageMentions.data, null, 2));
    console.groupEnd();
  });

  // No visible UI; dev-only helper
  return (
    <Show when={false}>
      <div />
    </Show>
  );
}
