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
  triggeringUsername: string,
  depth: number = 0
) => {
  try {
    console.log("[agent] Processing agent response", { agentId, depth });

    // Stop if max depth reached
    if (depth >= 5) {
      await query(`UPDATE messages SET content = $1 WHERE id = $2`, [
        "Maximum collaboration depth reached (5).",
        agentMessageId,
      ]);
      return { success: true, agentMessageId };
    }

    // Get agent info (system instructions and name)
    const agentInfo = await query(
      `SELECT name, system_instructions FROM agents WHERE id = $1`,
      [agentId]
    );
    const agentName = agentInfo.rows[0]?.name || "Agent";
    const systemInstructions = agentInfo.rows[0]?.system_instructions || "";

    // Get all agents in the channel with their descriptions
    const channelAgents = await query(
      `SELECT a.id, a.name, a.description 
       FROM agents a
       JOIN channel_members cm ON cm.member_id = a.id::text AND cm.member_type = 'agent'
       WHERE cm.channel_id = $1 AND a.id::text != $2
       ORDER BY a.name`,
      [channelId, agentId]
    );

    // Build agent context for instructions
    let agentContext = "";
    if (channelAgents.rows.length > 0) {
      agentContext = "\n\nOther agents in this channel:\n";
      for (const agent of channelAgents.rows) {
        agentContext += `- @${agent.name}: ${agent.description}\n`;
      }
      agentContext +=
        "\nYou can mention other agents using @agentname to collaborate with them.";
    }

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

    // Build instructions with agent context
    let instructions =
      systemInstructions || "You are a helpful assistant in a chat channel.";
    if (triggeringUsername) {
      instructions += ` Always mention the user who triggered you by using @${triggeringUsername} in your response.`;
    }
    instructions += agentContext;

    const agent = new Agent({
      name: agentName,
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

    // Parse response for @mentions of other agents
    const mentionedNames = Array.from(acc.matchAll(/@([a-z0-9_]+)/gi)).map(
      (m) => m[1].toLowerCase()
    );

    // Find mentioned agent IDs
    const mentionedAgentIds: string[] = [];
    for (const agentRow of channelAgents.rows) {
      if (mentionedNames.includes(agentRow.name.toLowerCase())) {
        mentionedAgentIds.push(agentRow.id);
      }
    }

    // Trigger all mentioned agents simultaneously
    if (mentionedAgentIds.length > 0) {
      console.log("[agent] Triggering mentioned agents", mentionedAgentIds);

      const triggerPromises = mentionedAgentIds.map(
        async (mentionedAgentId) => {
          const newAgentMessageId = crypto.randomUUID();
          const agentMessageCreatedAt = new Date().toISOString();

          // Insert placeholder "Thinking..." message
          await query(
            `INSERT INTO messages (id, channel_id, author_type, author_id, content, created_at) VALUES ($1, $2, 'agent', $3, $4, $5)`,
            [
              newAgentMessageId,
              channelId,
              mentionedAgentId,
              "Thinking...",
              agentMessageCreatedAt,
            ]
          );

          // Trigger agent response
          return processAgentResponse(
            channelId,
            mentionedAgentId,
            newAgentMessageId,
            acc, // Use the agent's response as the trigger message
            agentName, // The triggering agent's name
            depth + 1
          );
        }
      );

      // Wait for all agents to complete
      await Promise.all(triggerPromises);
    }

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
