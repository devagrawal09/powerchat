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

    // Get agent info (system instructions, name, and description)
    const agentInfo = await query(
      `SELECT name, system_instructions, description FROM agents WHERE id = $1`,
      [agentId]
    );
    const agentName = agentInfo.rows[0]?.name || "Agent";
    const systemInstructions = agentInfo.rows[0]?.system_instructions || "";
    const agentDescription = agentInfo.rows[0]?.description || "";

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
        "\n\nIMPORTANT DELEGATION RULES:\n" +
        "- ONLY use @agentname when you explicitly want to DELEGATE a task and trigger that agent to respond\n" +
        "- When merely describing, discussing, or explaining what an agent does, use their plain name WITHOUT the @ symbol\n" +
        "- Examples:\n" +
        '  ✓ CORRECT: "The researcher agent specializes in gathering information..."\n' +
        '  ✓ CORRECT: "You could ask researcher to analyze this data."\n' +
        '  ✗ WRONG: "The @researcher agent specializes in..." (this would trigger researcher)\n' +
        '  ✓ CORRECT (delegation): "@researcher Can you analyze this dataset?" (this SHOULD trigger researcher)\n' +
        "- Use @mentions sparingly and only when you truly need another agent to take action\n" +
        "- SEQUENTIAL vs PARALLEL DELEGATION:\n" +
        "  • Do NOT mention multiple agents at once unless their tasks are completely independent and can run in parallel\n" +
        "  • If tasks depend on each other (e.g., analysis depends on research, writing depends on analysis), delegate sequentially:\n" +
        "    ✓ CORRECT: First mention @researcher, wait for their response, then mention @analyst\n" +
        "    ✗ WRONG: Mentioning @researcher @analyst @writer all at once when they depend on each other\n" +
        "  • Only mention multiple agents simultaneously if their tasks are truly independent (e.g., researching different unrelated topics)";
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

    // Get tools based on agent capabilities
    // Only research-oriented agents get Firecrawl tools
    // Assistant should coordinate/delegate, not do research itself
    const allTools = await mcpClient.getTools();
    const agentNameLower = agentName.toLowerCase();

    // Agents that should have Firecrawl access
    const researchAgents = ["researcher", "analyst", "writer"];
    const hasResearchAccess = researchAgents.includes(agentNameLower);

    // Filter tools: Assistant gets no tools, research agents get Firecrawl tools
    const tools = hasResearchAccess ? allTools : []; // Assistant and other non-research agents get no tools

    // Build instructions with agent context
    let instructions =
      systemInstructions || "You are a helpful assistant in a chat channel.";

    // Add agent's own identity
    instructions += `\n\nYou are ${agentName}`;
    if (agentDescription) {
      instructions += `: ${agentDescription}`;
    }
    instructions += `.`;

    // Add tool usage instructions for research agents
    if (hasResearchAccess) {
      instructions += `\n\nCRITICAL: After using tools to gather information, you MUST provide a clear, comprehensive text summary of your findings. Your response must end with actual written text explaining what you found, not just tool calls. Do not end your response until you have provided a written summary.`;
    }

    // // Add tool availability context
    // if (!hasResearchAccess) {
    //   instructions += `\n\nIMPORTANT: You do not have access to web research tools. When research, analysis, or data gathering is needed, you must delegate to specialized agents who have these capabilities.`;
    // }

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

    console.log("[agent] instructions", instructions);
    console.log("[agent] input", input);

    let acc = "";
    try {
      const stream = await agent.stream(input);
      console.log("[agent] Stream initialized, starting to process events");

      try {
        for await (const ev of stream.fullStream) {
          console.log("[agent] event", ev?.type);
          try {
            if (ev.type === "text-delta") {
              acc += ev.payload?.text ?? "";
            } else if (ev.type === "tool-call") {
              const name = ev.payload?.toolName ?? "tool";
              const args = ev.payload?.args ?? {};
              console.log("[agent] tool call:", name);
              acc += `\n\n**Tool Call: ${name}**`;
            } else if (ev.type === "tool-result") {
              const id = ev.payload?.toolCallId ?? "";
              const name = ev.payload?.toolName ?? "tool";
              const result = ev.payload?.result;
              console.log(
                "[agent] tool result:",
                name,
                result ? "success" : "no result"
              );
              acc += `\n\n**Tool Result: ${name}**`;
              if (result && typeof result === "string" && result.length > 0) {
                // Include a snippet of the result if it's a string
                const snippet =
                  result.length > 200
                    ? result.substring(0, 200) + "..."
                    : result;
                acc += `\n${snippet}`;
              }
            } else if (ev.type === "reasoning-delta") {
              const t = ev.payload?.text ?? "";
              if (t) acc += t;
            } else if (ev.type === "text-end") {
              console.log("[agent] text end");
              acc += "\n\n";
            } else if (ev.type === "step-finish") {
              console.log("[agent] step finish");
              acc += "\n\n";
            } else if (ev.type === "tool-output") {
              console.log("[agent] tool output:", ev.payload?.toolName);
              acc += `\n\n*Tool Call Complete: ${
                ev.payload?.toolName ?? "tool"
              }*`;
            } else if (ev.type === "error") {
              console.error("[agent] stream error event:", ev.payload);
              acc += `\n\n[Error: ${ev.payload?.message || "Unknown error"}]`;
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
        console.log("[agent] Stream completed successfully");
      } catch (streamError: any) {
        console.error("[agent] Stream processing error:", streamError);
        console.error("[agent] Error stack:", streamError.stack);
        acc += `\n\n[Error: ${
          streamError.message || "Stream processing failed"
        }]`;
        await query(`UPDATE messages SET content = $1 WHERE id = $2`, [
          acc,
          agentMessageId,
        ]);
        throw streamError;
      }
    } catch (streamInitError: any) {
      console.error("[agent] Failed to initialize stream:", streamInitError);
      console.error("[agent] Error stack:", streamInitError.stack);
      acc = `Error: Failed to process agent response - ${
        streamInitError.message || "Unknown error"
      }`;
      await query(`UPDATE messages SET content = $1 WHERE id = $2`, [
        acc,
        agentMessageId,
      ]);
      throw streamInitError;
    }

    console.log(
      "[agent] Agent response complete, accumulated length:",
      acc.length
    );

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
