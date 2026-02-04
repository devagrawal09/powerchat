import { queryInternal } from "./db";
import { processAgentResponse } from "./agent";

type MessageRow = {
  id: string;
  channel_id: string;
  author_id: string;
  content: string | null;
};

export async function onMessage(message: MessageRow): Promise<void> {
  const content = message.content?.trim();
  console.log("[onMessage] received", {
    id: message.id,
    channelId: message.channel_id,
    authorId: message.author_id,
    hasContent: Boolean(content),
  });
  if (!content) return;

  const mentionedNames = Array.from(content.matchAll(/@([a-z0-9_]+)/gi)).map(
    (match) => match[1].toLowerCase(),
  );
  console.log("[onMessage] parsed mentions", {
    id: message.id,
    mentions: mentionedNames,
  });

  if (mentionedNames.length === 0) return;

  const agentRows = await queryInternal(
    `SELECT a.id, a.name
     FROM agents a
     JOIN channel_members cm
       ON cm.member_id = a.id::text
      AND cm.member_type = 'agent'
     WHERE cm.channel_id = $1
     ORDER BY a.name`,
    [message.channel_id],
  );

  if (!agentRows.rows?.length) return;

  const agentIdByName = new Map<string, string>();
  for (const row of agentRows.rows) {
    if (!row?.name || !row?.id) continue;
    agentIdByName.set(String(row.name).toLowerCase(), String(row.id));
  }

  const mentionedAgentIds = new Set<string>();
  for (const name of mentionedNames) {
    const id = agentIdByName.get(name);
    if (id) mentionedAgentIds.add(id);
  }
  console.log("[onMessage] resolved agents", {
    id: message.id,
    agentIds: Array.from(mentionedAgentIds),
  });

  if (mentionedAgentIds.size === 0) return;

  const triggerPromises = Array.from(mentionedAgentIds).map(async (agentId) => {
    const agentMessageId = crypto.randomUUID();
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
    console.log("[onMessage] inserted placeholder", {
      id: message.id,
      agentId,
      agentMessageId,
    });

    const result = await processAgentResponse(
      message.channel_id,
      agentId,
      agentMessageId,
      content,
      message.author_id,
      0,
    );

    console.log("[onMessage] agent response complete", {
      id: message.id,
      agentId,
      agentMessageId,
      result,
    });

    return result;
  });

  await Promise.all(triggerPromises);
  console.log("[onMessage] all agents completed", { id: message.id });
}
