import { createSignal, Show, For, createMemo } from "solid-js";
import { writeTransaction } from "~/lib/powersync";
import { useWatchedQuery } from "~/lib/useWatchedQuery";
import { getUsername } from "~/lib/getUsername";

type ChannelInviteProps = {
  channelId: string;
};

type AgentRow = {
  id: string;
  name: string;
  description: string;
};

type MemberRow = {
  member_id: string;
};

type UserRow = {
  id: string;
};

export function ChannelInvite(props: ChannelInviteProps) {
  const [username, setUsername] = createSignal("");
  const [selectedAgentId, setSelectedAgentId] = createSignal<string | null>(
    null
  );
  const [inviteType, setInviteType] = createSignal<"user" | "agent">("user");
  const [submitting, setSubmitting] = createSignal(false);
  const [message, setMessage] = createSignal<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Get all available agents
  const allAgents = useWatchedQuery<AgentRow>(
    () => `SELECT id, name, description FROM agents ORDER BY name`,
    () => []
  );

  // Get agents already in channel
  const channelAgents = useWatchedQuery<MemberRow>(
    () =>
      `SELECT member_id FROM channel_members WHERE channel_id = ? AND member_type = 'agent'`,
    () => [props.channelId]
  );

  // Get all users for validation
  const allUsers = useWatchedQuery<UserRow>(
    () => `SELECT id FROM users`,
    () => []
  );

  // Get current channel members to check for duplicates
  const channelMembers = useWatchedQuery<MemberRow>(
    () => `SELECT member_id FROM channel_members WHERE channel_id = ?`,
    () => [props.channelId]
  );

  // Filter out agents already in channel
  const availableAgents = createMemo(() => {
    const inChannel = new Set(
      channelAgents.data?.map((a) => a.member_id) || []
    );
    return (allAgents.data || []).filter((a) => !inChannel.has(a.id));
  });

  const handleInviteUser = async (e: Event) => {
    e.preventDefault();
    const value = username().trim();
    const currentUser = getUsername();

    if (!value) {
      setMessage({ type: "error", text: "Please enter a username" });
      return;
    }

    // Verify current user is a member of the channel
    const currentUserIsMember = (channelMembers.data || []).find(
      (m) => m.member_id === currentUser
    );
    if (!currentUserIsMember) {
      setMessage({
        type: "error",
        text: "You must be a member of this channel to invite users",
      });
      return;
    }

    // Check if user exists
    const userExists = (allUsers.data || []).find((u) => u.id === value);
    if (!userExists) {
      setMessage({ type: "error", text: "User not found" });
      return;
    }

    // Check if user is already a member
    const isMember = (channelMembers.data || []).find(
      (m) => m.member_id === value
    );
    if (isMember) {
      setMessage({ type: "error", text: "User is already a member" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const memberId = crypto.randomUUID();
      const now = new Date().toISOString();

      await writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO channel_members (id, channel_id, member_type, member_id, joined_at)
           VALUES (?, ?, 'user', ?, ?)`,
          [memberId, props.channelId, value, now]
        );
      });

      setMessage({ type: "success", text: `${value} added to channel!` });
      setUsername("");
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "Failed to invite user",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInviteAgent = async () => {
    const agentId = selectedAgentId();
    const currentUser = getUsername();

    if (!agentId) {
      setMessage({ type: "error", text: "Please select an agent" });
      return;
    }

    // Verify current user is a member of the channel
    const currentUserIsMember = (channelMembers.data || []).find(
      (m) => m.member_id === currentUser
    );
    if (!currentUserIsMember) {
      setMessage({
        type: "error",
        text: "You must be a member of this channel to invite agents",
      });
      return;
    }

    // Check if agent exists
    const agentExists = (allAgents.data || []).find((a) => a.id === agentId);
    if (!agentExists) {
      setMessage({ type: "error", text: "Agent not found" });
      return;
    }

    // Check if agent is already a member
    const isMember = (channelMembers.data || []).find(
      (m) => m.member_id === agentId
    );
    if (isMember) {
      setMessage({ type: "error", text: "Agent is already a member" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const memberId = crypto.randomUUID();
      const now = new Date().toISOString();

      await writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO channel_members (id, channel_id, member_type, member_id, joined_at)
           VALUES (?, ?, 'agent', ?, ?)`,
          [memberId, props.channelId, agentId, now]
        );
      });

      const agentName =
        availableAgents().find((a) => a.id === agentId)?.name || "Agent";
      setMessage({ type: "success", text: `${agentName} added to channel!` });
      setSelectedAgentId(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "Failed to invite agent",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="p-4 border-t border-gray-200">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">Invite</h3>

      <div class="flex gap-2 mb-3">
        <button
          onClick={() => setInviteType("user")}
          class={`flex-1 px-3 py-1 text-xs rounded ${
            inviteType() === "user"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          User
        </button>
        <button
          onClick={() => setInviteType("agent")}
          class={`flex-1 px-3 py-1 text-xs rounded ${
            inviteType() === "agent"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Agent
        </button>
      </div>

      <Show when={inviteType() === "user"}>
        <form onSubmit={handleInviteUser} class="space-y-2">
          <input
            type="text"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            placeholder="Enter username"
            class="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 bg-white"
            disabled={submitting()}
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

          <button
            type="submit"
            disabled={submitting() || !username().trim()}
            class="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting() ? "Adding..." : "Add User"}
          </button>
        </form>
      </Show>

      <Show when={inviteType() === "agent"}>
        <div class="space-y-2">
          <Show
            when={!allAgents.loading}
            fallback={
              <div class="text-xs text-gray-500">Loading agents...</div>
            }
          >
            <Show
              when={availableAgents().length > 0}
              fallback={
                <div class="text-xs text-gray-500">
                  No available agents to invite
                </div>
              }
            >
              <select
                value={selectedAgentId() || ""}
                onChange={(e) =>
                  setSelectedAgentId(e.currentTarget.value || null)
                }
                class="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                disabled={submitting()}
              >
                <option value="">Select an agent</option>
                <For each={availableAgents()}>
                  {(agent) => <option value={agent.id}>{agent.name}</option>}
                </For>
              </select>
            </Show>
          </Show>

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

          <button
            onClick={handleInviteAgent}
            disabled={submitting() || !selectedAgentId()}
            class="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting() ? "Adding..." : "Add Agent"}
          </button>
        </div>
      </Show>
    </div>
  );
}
