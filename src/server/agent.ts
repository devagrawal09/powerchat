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
  userMessage: string,
  triggeringUsername: string
) => {
  try {
    console.log("[agent] Processing agent response");

    // Query recent message history
    const messages = await query(
      `SELECT m.author_type, m.content,
        CASE 
          WHEN m.author_type = 'user' THEN u.id
          WHEN m.author_type = 'agent' THEN a.name
          WHEN m.author_type = 'system' THEN 'System'
        END as author_name
       FROM messages m
       LEFT JOIN users u ON m.author_type = 'user' AND m.author_id = u.id
       LEFT JOIN agents a ON m.author_type = 'agent' AND m.author_id = a.id::text
       WHERE m.channel_id = $1 
       ORDER BY m.created_at ASC, m.id ASC 
       LIMIT 30`,
      [channelId]
    );

    const history = (messages.rows || [])
      .map((m) => ({
        role: m.author_type === "user" ? "user" : "assistant",
        name: m.author_name,
        content: m.content,
      }))
      .map((m) => JSON.stringify(m, null, 2))
      .join("\n");

    const input = `Channel: ${channelId}\n${history}\nUser: ${userMessage}`;

    const tools = await mcpClient.getTools();

    // Build instructions with mention requirement
    let instructions = "You are a helpful assistant in a chat channel.";
    if (triggeringUsername) {
      instructions += ` Always mention the user who triggered you by using @${triggeringUsername} in your response.`;
    }

    const agent = new Agent({
      name: "channel-assistant",
      instructions,
      model: process.env.AI_MODEL || "openai/gpt-5",
      tools,
    });

    console.log("[agent] input", input);

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
          const name = ev.payload?.toolName ?? "tool";
          const args = ev.payload?.args ?? {};
          acc += `\n\n**Tool Call: ${name}**`;
        } else if (ev.type === "tool-result") {
          const id = ev.payload?.toolCallId ?? "";
          const name = ev.payload?.toolName ?? "tool";
          acc += `\n\n**Tool Result: ${name}**`;
        } else if (ev.type === "reasoning-delta") {
          const t = ev.payload?.text ?? "";
          if (t) acc += t;
        } else if (ev.type === "text-end") {
          console.log("[agent] text end", ev);
          acc += "\n\n";
        } else if (ev.type === "step-finish") {
          console.log("[agent] step finish", ev);
          acc += "\n\n";
        } else if (ev.type === "tool-output") {
          console.log("[agent] tool output", ev);
          acc += `\n\n*Tool Call Complete: ${ev.payload?.toolName ?? "tool"}*`;
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

    // Update existing message with error
    try {
      await query(`UPDATE messages SET content = $1 WHERE id = $2`, [
        `Error: ${error.message}`,
        agentMessageId,
      ]);
    } catch (dbError) {
      console.error("[agent] Failed to update error message:", dbError);
    }

    return { success: false, error: error.message };
  }
};
