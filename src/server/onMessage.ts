import { queryInternal } from "./db";
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

    await queryInternal(
      `INSERT INTO messages (id, channel_id, author_type, author_id, content, created_at)
       VALUES ($1, $2, 'agent', $3, $4, $5)`,
      [
        agentMessageId,
        message.channel_id,
        agentId,
        "Thinking...",
        agentMessageCreatedAt,
      ],
    );

    await queryInternal(
      `INSERT INTO agent_runs (id, channel_id, agent_id, agent_message_id, status, trace, started_at)
       VALUES ($1, $2, $3, $4, 'running', '', $5)`,
      [
        agentRunId,
        message.channel_id,
        agentId,
        agentMessageId,
        agentMessageCreatedAt,
      ],
    );

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
  const result = await queryInternal(
    `SELECT a.id
     FROM agents a
     JOIN channel_members cm
       ON cm.member_id = a.id::text
      AND cm.member_type = 'agent'
     WHERE cm.channel_id = $1
       AND a.id = $2::uuid`,
    [message.channel_id, parsed.id],
  );

  if (!result.rows?.length) {
    console.warn("[onMessage] mentioned agent not found or not in channel", parsed);
    return [];
  }

  return [String(result.rows[0].id)];
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

  const agentRows = await queryInternal(
    `SELECT a.id, a.name
     FROM agents a
     JOIN channel_members cm
       ON cm.member_id = a.id::text
      AND cm.member_type = 'agent'
     WHERE cm.channel_id = $1
       AND lower(a.name) = ANY($2)
     ORDER BY a.name`,
    [channelId, mentionedNames],
  );

  if (!agentRows.rows?.length) return [];

  return agentRows.rows.map((row) => String(row.id));
}
