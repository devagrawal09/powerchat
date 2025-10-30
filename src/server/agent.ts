"use server";
import { Agent } from "@mastra/core/agent";
import { query, getMany } from "./db";

// Create Mastra agent
const agent = new Agent({
  name: "channel-assistant",
  instructions: "You are a helpful assistant in a chat channel.",
  model: process.env.AI_MODEL || "openai/gpt-5",
});

// Track processed messages for idempotency
const processedMessages = new Set<string>();

export async function triggerAgent(args: {
  channelId: string;
  messageId: string;
  content: string;
  agentIds: string[];
}) {
  const { channelId, messageId, content, agentIds } = args;

  // Idempotency check
  if (processedMessages.has(messageId)) {
    return { skipped: true };
  }
  processedMessages.add(messageId);

  // Fetch recent messages for context (last 30)
  const recentMessages = await getMany<{
    author_type: string;
    author_id: string;
    content: string;
    created_at: string;
  }>(
    `SELECT author_type, author_id, content, created_at 
     FROM messages 
     WHERE channel_id = $1 
     ORDER BY created_at DESC, id DESC 
     LIMIT 30`,
    [channelId]
  );

  // Build conversation history
  const history = recentMessages.reverse().map((msg) => ({
    role: msg.author_type === "user" ? "user" : "assistant",
    content: msg.content,
  }));

  // Call Mastra for each mentioned agent (for MVP, just use first)
  const agentId = agentIds[0];
  if (!agentId) return { error: "No agent mentioned" };

  try {
    const messages = [
      { role: "system", content: `Channel: ${channelId}` },
      ...history,
      { role: "user", content },
    ];

    const response = await agent.generate(messages as any);
    const replyText = response.text || "";

    // Insert agent reply into database
    await query(
      `INSERT INTO messages (channel_id, author_type, author_id, content) 
       VALUES ($1, 'agent', $2, $3)`,
      [channelId, agentId, replyText]
    );

    // Insert mention record for tracking
    await query(
      `INSERT INTO message_mentions (message_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [messageId, agentId]
    );

    return { success: true, reply: replyText };
  } catch (error) {
    console.error("Agent trigger failed:", error);
    return { error: "Agent failed to respond" };
  }
}
