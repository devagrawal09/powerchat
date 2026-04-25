import { and, asc, eq } from "drizzle-orm";
import {
  agents,
  channelMembers as channelMembersTable,
  clientDb,
  liveQuery,
  users,
} from "~/db/client";
import { createSignal, Show, For, createMemo } from "solid-js";
import { useQuery } from "~/lib/powersync-solid";
import { getUsername } from "~/lib/getUsername";

type ChannelInviteProps = {
  channelId: string;
};

export function ChannelInvite(props: ChannelInviteProps) {
  const [username, setUsername] = createSignal("");
  const [selectedAgentId, setSelectedAgentId] = createSignal<string | null>(
    null,
  );
  const [inviteType, setInviteType] = createSignal<"user" | "agent">("user");
  const [submitting, setSubmitting] = createSignal(false);
  const [message, setMessage] = createSignal<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const allAgents = useQuery(() =>
    liveQuery(
      clientDb
        .select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
        })
        .from(agents)
        .orderBy(asc(agents.name)),
    ),
  );

  const channelAgents = useQuery(() =>
    liveQuery(
      clientDb
        .select({ member_id: channelMembersTable.memberId })
        .from(channelMembersTable)
        .where(
          and(
            eq(channelMembersTable.channelId, props.channelId),
            eq(channelMembersTable.memberType, "agent"),
          ),
        ),
    ),
  );

  const allUsers = useQuery(() =>
    liveQuery(
      clientDb.select({ id: users.id }).from(users).orderBy(asc(users.id)),
    ),
  );

  const channelMembers = useQuery(() =>
    liveQuery(
      clientDb
        .select({ member_id: channelMembersTable.memberId })
        .from(channelMembersTable)
        .where(eq(channelMembersTable.channelId, props.channelId)),
    ),
  );

  const availableAgents = createMemo(() => {
    const inChannel = new Set(
      channelAgents().data?.map((a) => a.member_id) || [],
    );
    return (allAgents().data || []).filter((a) => !inChannel.has(a.id));
  });

  const handleInviteUser = async (e: Event) => {
    e.preventDefault();
    const value = username().trim();
    const currentUser = getUsername();

    if (!value) {
      setMessage({ type: "error", text: "Please enter a username" });
      return;
    }

    const currentUserIsMember = (channelMembers().data || []).find(
      (m) => m.member_id === currentUser,
    );
    if (!currentUserIsMember) {
      setMessage({
        type: "error",
        text: "You must be a member of this channel to invite users",
      });
      return;
    }

    const userExists = (allUsers().data || []).find((u) => u.id === value);
    if (!userExists) {
      setMessage({ type: "error", text: "User not found" });
      return;
    }

    const isMember = (channelMembers().data || []).find(
      (m) => m.member_id === value,
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

      await clientDb.insert(channelMembersTable).values({
        id: memberId,
        channelId: props.channelId,
        memberType: "user",
        memberId: value,
        joinedAt: now,
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

    const currentUserIsMember = (channelMembers().data || []).find(
      (m) => m.member_id === currentUser,
    );
    if (!currentUserIsMember) {
      setMessage({
        type: "error",
        text: "You must be a member of this channel to invite agents",
      });
      return;
    }

    const agentExists = (allAgents().data || []).find((a) => a.id === agentId);
    if (!agentExists) {
      setMessage({ type: "error", text: "Agent not found" });
      return;
    }

    const isMember = (channelMembers().data || []).find(
      (m) => m.member_id === agentId,
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

      await clientDb.insert(channelMembersTable).values({
        id: memberId,
        channelId: props.channelId,
        memberType: "agent",
        memberId: agentId,
        joinedAt: now,
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
    <div>
      <h3 class="text-xs font-semibold text-gray-500 uppercase mb-2">Invite</h3>

      <div class="flex gap-1 mb-3 bg-gray-100 rounded-md p-0.5">
        <button
          onClick={() => setInviteType("user")}
          class={`flex-1 px-3 py-1.5 text-xs rounded font-medium transition-all ${
            inviteType() === "user"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          User
        </button>
        <button
          onClick={() => setInviteType("agent")}
          class={`flex-1 px-3 py-1.5 text-xs rounded font-medium transition-all ${
            inviteType() === "agent"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
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
            class="input text-sm"
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
            class="btn btn-primary w-full py-2"
          >
            {submitting() ? "Adding..." : "Add User"}
          </button>
        </form>
      </Show>

      <Show when={inviteType() === "agent"}>
        <div class="space-y-2">
          <Show
            when={!allAgents().isLoading}
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
                class="input text-sm"
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
            class="btn btn-primary w-full py-2"
          >
            {submitting() ? "Adding..." : "Add Agent"}
          </button>
        </div>
      </Show>
    </div>
  );
}
