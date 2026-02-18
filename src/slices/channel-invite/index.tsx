import { createSignal, Show, For, createMemo } from "solid-js";
import { and, eq, useLiveQuery } from "@tanstack/solid-db";
import { getUsername } from "~/lib/getUsername";
import {
  agentsCollection,
  channelMembersCollection,
  ensureTanStackDbReady,
  usersCollection,
} from "~/lib/tanstack-db";

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
  const allAgents = useLiveQuery((q) =>
    q
      .from({ agent: agentsCollection })
      .orderBy(({ agent }) => agent.name)
      .select(({ agent }) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
      })),
  );

  // Get agents already in channel
  const channelAgents = useLiveQuery((q) =>
    q
      .from({ member: channelMembersCollection })
      .where(({ member }) =>
        and(eq(member.channel_id, props.channelId), eq(member.member_type, "agent")),
      )
      .select(({ member }) => ({ member_id: member.member_id })),
  );

  // Get all users for validation
  const allUsers = useLiveQuery((q) =>
    q.from({ user: usersCollection }).select(({ user }) => ({ id: user.id })),
  );

  // Get current channel members to check for duplicates
  const channelMembers = useLiveQuery((q) =>
    q
      .from({ member: channelMembersCollection })
      .where(({ member }) => eq(member.channel_id, props.channelId))
      .select(({ member }) => ({ member_id: member.member_id })),
  );

  // Filter out agents already in channel
  const availableAgents = createMemo(() => {
    const inChannel = new Set(
      channelAgents().map((a) => a.member_id) || []
    );
    return allAgents().filter((a) => !inChannel.has(a.id));
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
    const currentUserIsMember = channelMembers().find(
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
    const userExists = allUsers().find((u) => u.id === value);
    if (!userExists) {
      setMessage({ type: "error", text: "User not found" });
      return;
    }

    // Check if user is already a member
    const isMember = channelMembers().find(
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

      await ensureTanStackDbReady();
      await channelMembersCollection
        .insert({
          id: memberId,
          channel_id: props.channelId,
          member_type: "user",
          member_id: value,
          joined_at: now,
        })
        .isPersisted.promise;

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
    const currentUserIsMember = channelMembers().find(
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
    const agentExists = allAgents().find((a) => a.id === agentId);
    if (!agentExists) {
      setMessage({ type: "error", text: "Agent not found" });
      return;
    }

    // Check if agent is already a member
    const isMember = channelMembers().find(
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

      await ensureTanStackDbReady();
      await channelMembersCollection
        .insert({
          id: memberId,
          channel_id: props.channelId,
          member_type: "agent",
          member_id: agentId,
          joined_at: now,
        })
        .isPersisted.promise;

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
            when={!allAgents.isLoading && allAgents.isReady}
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
