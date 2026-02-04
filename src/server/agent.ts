"use server";
import { Agent } from "@mastra/core/agent";
import { query } from "./db";
import { listDocuments, createDocument, readDocument } from "./tools/documents";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const processAgentResponse = async (
  channelId: string,
  agentId: string,
  agentMessageId: string,
  userMessage: string,
  triggeringUsername: string,
  depth: number = 0,
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
      [agentId],
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
      [channelId, agentId],
    );

    // Get all documents in the channel
    const channelDocuments = await query(
      `SELECT id, title, description
       FROM documents
       WHERE channel_id = $1
       ORDER BY created_at DESC`,
      [channelId],
    );

    // Build agent context for instructions
    let agentContext = "";
    if (channelAgents.rows.length > 0) {
      agentContext = "\n\nOther agents available in this channel:\n";
      for (const agent of channelAgents.rows) {
        agentContext += `- @${agent.name}: ${agent.description}\n`;
      }
      agentContext +=
        "\n\nGUIDELINES:\n" +
        "- Delegate to other agents using @agentname when their expertise matches the task\n" +
        "- Use @agentname ONLY for immediate delegation; use plain names for future mentions\n" +
        "- Delegate sequentially (one @mention at a time) when tasks depend on each other\n" +
        "- Keep responses concise (2-4 sentences); use documents for detailed content\n" +
        "- Create documents for long-form content and reference them with #title\n" +
        "- When delegating, create documents to transfer knowledge and context";
    }

    // Add documents context
    if (channelDocuments.rows.length > 0) {
      agentContext += "\n\nDocuments available in this channel:\n";
      for (const doc of channelDocuments.rows) {
        agentContext += `- #${doc.title}: ${doc.description}\n`;
      }
      agentContext +=
        "\nYou can reference these documents using #title format in your responses.";
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
      [channelId],
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

    // Build instructions with agent context
    let instructions =
      systemInstructions || "You are a helpful assistant in a chat channel.";

    // Add agent's own identity
    instructions += `\n\nYou are ${agentName}`;
    if (agentDescription) {
      instructions += `: ${agentDescription}`;
    }
    instructions += `.`;

    if (triggeringUsername) {
      instructions += ` Always mention the user who triggered you by using @${triggeringUsername} in your response.`;
    }
    instructions += agentContext;

    if (channelDocuments.rows.length > 0 || channelAgents.rows.length > 0) {
      instructions += `\n\nChannel ID: ${channelId} (use this when calling document tools)`;
    }

    const agent = new Agent({
      name: agentName,
      instructions,
      model: process.env.AI_MODEL || "openrouter/anthropic/claude-haiku-4.5",
      tools: {
        listDocuments,
        createDocument,
        readDocument,
      },
    });

    console.log("[agent] instructions", instructions);
    console.log("[agent] input", input);

    // Log agent input and output to file
    const logDir = join(process.cwd(), "logs");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    // Sanitize agent name for filename (replace spaces and special chars with hyphens)
    const sanitizedAgentName = agentName
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase();
    const logFile = join(
      logDir,
      `agent-${sanitizedAgentName}-${timestamp}.log`,
    );

    // Ensure logs directory exists
    try {
      await mkdir(logDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore
    }

    // Helper function to format log entry as plain text
    const formatLogEntry = (
      output: string,
      error?: string,
      completedAt?: string,
    ): string => {
      const timestamp = new Date().toISOString();

      let log = `========================================\n`;
      log += `AGENT LOG ENTRY\n`;
      log += `========================================\n\n`;
      log += `Timestamp: ${timestamp}\n`;
      log += `Agent ID: ${agentId}\n`;
      log += `Agent Name: ${agentName}\n`;
      log += `Channel ID: ${channelId}\n`;
      log += `Depth: ${depth}\n`;
      if (completedAt) {
        log += `Completed At: ${completedAt}\n`;
      }
      if (error) {
        log += `Error: ${error}\n`;
      }
      log += `\n`;
      log += `--- INPUT ---\n`;
      log += `Instructions:\n${instructions}\n`;
      log += `\n`;
      log += `Full Input:\n${input}\n`;
      log += `\n`;
      log += `--- OUTPUT ---\n`;
      log += `${output}\n`;
      log += `\n`;
      log += `========================================\n`;

      return log;
    };

    // Write initial log entry with input
    await writeFile(logFile, formatLogEntry("", undefined, undefined));

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
            } else if (ev.type === "tool-result") {
              const id = ev.payload?.toolCallId ?? "";
              const name = ev.payload?.toolName ?? "tool";
              const result = ev.payload?.result;
              console.log(
                "[agent] tool result:",
                name,
                result ? "success" : "no result",
              );
              acc += `\n\n*Tool Result: ${name}*`;
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
            } else if (ev.type === "tool-call-input-streaming-start") {
              const name = ev.payload?.toolName ?? "tool";
              console.log("[agent] tool call:", name);
              acc += `\n\n*Tool Call: ${name}*`;
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
        // Write error output to log file
        try {
          await writeFile(
            logFile,
            formatLogEntry(acc, streamError.message, new Date().toISOString()),
          );
        } catch (logError) {
          console.error("[agent] Failed to write error log file:", logError);
        }
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
      // Write initialization error to log file
      try {
        await writeFile(
          logFile,
          formatLogEntry(
            acc,
            streamInitError.message,
            new Date().toISOString(),
          ),
        );
      } catch (logError) {
        console.error("[agent] Failed to write error log file:", logError);
      }
      throw streamInitError;
    }

    console.log(
      "[agent] Agent response complete, accumulated length:",
      acc.length,
    );

    // Write complete output to log file
    try {
      await writeFile(
        logFile,
        formatLogEntry(acc, undefined, new Date().toISOString()),
      );
    } catch (error) {
      console.error("[agent] Failed to write log file:", error);
    }

    // Parse response for @mentions of other agents
    const mentionedNames = Array.from(acc.matchAll(/@([a-z0-9_]+)/gi)).map(
      (m) => m[1].toLowerCase(),
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
            ],
          );

          // Trigger agent response
          return processAgentResponse(
            channelId,
            mentionedAgentId,
            newAgentMessageId,
            acc, // Use the agent's response as the trigger message
            agentName, // The triggering agent's name
            depth + 1,
          );
        },
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

    // Write top-level error to log file
    try {
      const logDir = join(process.cwd(), "logs");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      // Get agent name (query for it since agentName may not be in scope)
      const errorAgentInfo = await query(
        `SELECT name FROM agents WHERE id = $1`,
        [agentId],
      );
      const errorAgentName = errorAgentInfo.rows[0]?.name || "unknown";
      // Sanitize agent name for filename (replace spaces and special chars with hyphens)
      const sanitizedAgentName = errorAgentName
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();
      const logFile = join(
        logDir,
        `agent-${sanitizedAgentName}-${timestamp}.log`,
      );

      let errorLog = `========================================\n`;
      errorLog += `AGENT LOG ENTRY (ERROR)\n`;
      errorLog += `========================================\n\n`;
      errorLog += `Timestamp: ${new Date().toISOString()}\n`;
      errorLog += `Agent ID: ${agentId}\n`;
      errorLog += `Channel ID: ${channelId}\n`;
      errorLog += `Depth: ${depth}\n`;
      errorLog += `Error: ${error.message}\n`;
      if (error.stack) {
        errorLog += `\nStack Trace:\n${error.stack}\n`;
      }
      errorLog += `\n========================================\n`;

      await writeFile(logFile, errorLog);
    } catch (logError) {
      console.error("[agent] Failed to write error log file:", logError);
    }

    return { success: false, error: error.message };
  }
};
