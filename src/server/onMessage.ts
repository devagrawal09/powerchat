import { and, eq, or, sql } from "drizzle-orm";
import {
  agentRuns,
  agents,
  channelMembers,
  messages,
} from "~/db/schema/server";
import { db } from "./db";
import { processAgentResponse } from "./agent";

type MentionedAgent = {
  id: string;
  type: "agent";
  name: string;
};

type MessageRow = {
  id: string;
  channel_id: string;
  author_id: string;
  content: string | null;
  mentioned_agent: string | null;
};

export async function onMessage(message: MessageRow): Promise<void> {
  const content = message.content?.trim();
  console.log("[onMessage] received", {
    id: message.id,
    channelId: message.channel_id,
    authorId: message.author_id,
    hasContent: Boolean(content),
    mentionedAgent: message.mentioned_agent,
  });
  if (!content) return;

  // Try metadata-driven routing first
  let agentIds = await resolveAgentFromMetadata(message);

  // Fallback: parse @mentions from text for backward compatibility
  if (agentIds.length === 0) {
    agentIds = await resolveAgentsFromText(content, message.channel_id);
  }

  if (agentIds.length === 0) return;

  console.log("[onMessage] resolved agents", {
    id: message.id,
    agentIds,
  });

  const triggerPromises = agentIds.map(async (agentId) => {
    const agentMessageId = crypto.randomUUID();
    const agentRunId = crypto.randomUUID();
    const agentMessageCreatedAt = new Date().toISOString();

    await db.insert(messages).values({
      id: agentMessageId,
      channelId: message.channel_id,
      authorType: "agent",
      authorId: agentId,
      content: "Thinking...",
      createdAt: agentMessageCreatedAt,
    });

    await db.insert(agentRuns).values({
      id: agentRunId,
      channelId: message.channel_id,
      agentId,
      agentMessageId,
      status: "running",
      trace: "",
      startedAt: agentMessageCreatedAt,
    });

    console.log("[onMessage] inserted placeholder + agent run", {
      id: message.id,
      agentId,
      agentMessageId,
      agentRunId,
    });

    const result = await processAgentResponse(
      message.channel_id,
      agentId,
      agentMessageId,
      agentRunId,
      content,
      message.author_id,
    );

    console.log("[onMessage] agent response complete", {
      id: message.id,
      agentId,
      agentMessageId,
      agentRunId,
      result,
    });

    return result;
  });

  await Promise.all(triggerPromises);
  console.log("[onMessage] all agents completed", { id: message.id });
}

/**
 * Resolve agent from structured metadata field.
 * Validates that the agent is active and a member of the channel.
 */
async function resolveAgentFromMetadata(message: MessageRow): Promise<string[]> {
  if (!message.mentioned_agent) return [];

  let parsed: MentionedAgent;
  try {
    parsed = JSON.parse(message.mentioned_agent);
  } catch {
    console.warn("[onMessage] invalid mentioned_agent JSON", message.mentioned_agent);
    return [];
  }

  if (!parsed.id || parsed.type !== "agent") return [];

  // Validate agent exists and is a member of this channel
  const result = await db
    .select({ id: agents.id })
    .from(agents)
    .innerJoin(
      channelMembers,
      sql`${channelMembers.memberId} = ${agents.id}::text and ${channelMembers.memberType} = 'agent'`,
    )
    .where(
      and(
        eq(channelMembers.channelId, message.channel_id),
        eq(agents.id, parsed.id),
      ),
    )
    .limit(1);

  if (!result.length) {
    console.warn("[onMessage] mentioned agent not found or not in channel", parsed);
    return [];
  }

  return [String(result[0].id)];
}

/**
 * Fallback: parse @mentions from message text.
 * Used for backward compatibility with messages that lack metadata.
 */
async function resolveAgentsFromText(content: string, channelId: string): Promise<string[]> {
  const mentionedNames = Array.from(content.matchAll(/@([a-z0-9_]+)/gi)).map(
    (match) => match[1].toLowerCase(),
  );
  console.log("[onMessage] fallback text parsing", { mentions: mentionedNames });

  if (mentionedNames.length === 0) return [];

  const agentRows = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .innerJoin(
      channelMembers,
      sql`${channelMembers.memberId} = ${agents.id}::text and ${channelMembers.memberType} = 'agent'`,
    )
    .where(
      and(
        eq(channelMembers.channelId, channelId),
        or(...mentionedNames.map((name) => sql`lower(${agents.name}) = ${name}`)),
      ),
    )
    .orderBy(agents.name);

  if (!agentRows.length) return [];

  return agentRows.map((row) => String(row.id));
}
