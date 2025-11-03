"use server";
import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";
import { query } from "./db";

// Create Mastra agent
// Prefer a hosted Firecrawl MCP server via FIRECRAWL_MCP_URL; fallback to npx
const firecrawlServerConfig = {
  url: new URL(
    `https://mcp.firecrawl.dev/${process.env.FIRECRAWL_API_KEY}/v2/mcp`
  ),
};

const mcpClient = new MCPClient({
  id: "powerchat-mcp-client",
  servers: {
    firecrawl: firecrawlServerConfig,
  },
});

export const processAgentResponse = async (
  channelId: string,
  agentId: string,
  agentMessageId: string,
  userMessage: string
) => {
  try {
    console.log("[agent] Processing agent response");

    // Query recent message history
    const messages = await query(
      `SELECT author_type, content FROM messages 
       WHERE channel_id = $1 
       ORDER BY created_at ASC, id ASC 
       LIMIT 30`,
      [channelId]
    );

    const history = (messages.rows || [])
      .map((m) => ({
        role: m.author_type === "user" ? "user" : "assistant",
        content: m.content,
      }))
      .join("\n");

    const input = `Channel: ${channelId}\n${history}\nUser: ${userMessage}`;

    const tools = await mcpClient.getTools();

    const agent = new Agent({
      name: "channel-assistant",
      instructions: "You are a helpful assistant in a chat channel.",
      model: process.env.AI_MODEL || "openai/gpt-5",
      tools,
    });

    const stream = await agent.stream(input);

    // Accumulate response
    let acc = "";
    for await (const ev of stream.fullStream) {
      console.log("[agent] event", ev);
      if (!ev) continue;
      try {
        if (ev.type === "text-delta") {
          acc += ev.payload?.text ?? "";
        } else if (ev.type === "tool-call") {
          // const name = ev.payload?.toolName ?? "tool";
          // const args = ev.payload?.args ?? {};
          //           acc += `
          // *Tool Call*
          // Tool: ${name}
          // ID: ${ev.payload?.toolCallId ?? ""}`;
        } else if (ev.type === "tool-result") {
          // const id = ev.payload?.toolCallId ?? "";
          // const name = ev.payload?.toolName ?? "tool";
          // const out =
          //   ev.payload?.result ?? ev.payload?.result ?? ev.payload ?? null;
          //           acc += `
          // *Tool Result*
          // Tool: ${name}
          // ID: ${id}`;
        } else if (ev.type === "reasoning-delta") {
          const t = ev.payload?.text ?? "";
          if (t) acc += t;
        }
        // Skip lifecycle events silently
      } catch (e) {
        console.error("[agent] error parsing event", e, ev);
      }

      // Write incremental update to database after each event
      if (acc) {
        await query(`UPDATE messages SET content = $1 WHERE id = $2`, [
          acc,
          agentMessageId,
        ]);
      }
    }

    console.log("[agent] Agent response complete");
    return { success: true, agentMessageId };
  } catch (error: any) {
    console.error("[agent] Failed to process agent response:", error);

    // Insert error message into the database
    const errorMessageId = crypto.randomUUID();
    const errorMessageCreatedAt = new Date().toISOString();
    try {
      await query(
        `INSERT INTO messages (id, channel_id, author_type, author_id, content, created_at)
         VALUES ($1, $2, 'agent', $3, $4, $5)`,
        [
          errorMessageId,
          channelId,
          agentId,
          `Error: ${error.message}`,
          errorMessageCreatedAt,
        ]
      );
    } catch (dbError) {
      console.error("[agent] Failed to insert error message:", dbError);
    }

    return { success: false, error: error.message };
  }
};
