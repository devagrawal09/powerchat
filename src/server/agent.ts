"use server";
import { Agent } from "@mastra/core/agent";
import { query } from "./db";
import { listDocuments, createDocument, readDocument } from "./tools/documents";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

type LogContext = {
  agentId: string;
  agentName: string;
  channelId: string;
  depth: number;
  instructions: string;
  input: string;
};

const maxDepth = 5;
const defaultModel = "openrouter/anthropic/claude-haiku-4.5";

const sanitizeName = (name: string) =>
  name.replace(/[^a-z0-9]/gi, "-").toLowerCase();

const buildAgentContext = (
  agents: { name: string; description: string }[],
  documents: { title: string; description: string }[],
): string => {
  let context = "";
  if (agents.length > 0) {
    context += "\n\nOther agents available in this channel:\n";
    for (const agent of agents) {
      context += `- @${agent.name}: ${agent.description}\n`;
    }
    context +=
      "\n\nGUIDELINES:\n" +
      "- Delegate to other agents using @agentname when their expertise matches the task\n" +
      "- Use @agentname ONLY for immediate delegation; use plain names for future mentions\n" +
      "- Delegate sequentially (one @mention at a time) when tasks depend on each other\n" +
      "- Keep responses concise (2-4 sentences); use documents for detailed content\n" +
      "- Create documents for long-form content and reference them with #title\n" +
      "- When delegating, create documents to transfer knowledge and context";
  }

  if (documents.length > 0) {
    context += "\n\nDocuments available in this channel:\n";
    for (const doc of documents) {
      context += `- #${doc.title}: ${doc.description}\n`;
    }
    context +=
      "\nYou can reference these documents using #title format in your responses.";
  }

  return context;
};

const buildHistory = (rows: any[]) =>
  (rows || [])
    .map((m) => ({
      role: m.author_type === "user" ? "user" : "assistant",
      name: m.author_name,
      content: m.content,
    }))
    .map((m) => JSON.stringify(m, null, 2))
    .join("\n");

const formatLogEntry = (
  ctx: LogContext,
  output: string,
  error?: string,
  completedAt?: string,
): string => {
  const timestamp = new Date().toISOString();
  let log = "========================================\n";
  log += "AGENT LOG ENTRY\n";
  log += "========================================\n\n";
  log += `Timestamp: ${timestamp}\n`;
  log += `Agent ID: ${ctx.agentId}\n`;
  log += `Agent Name: ${ctx.agentName}\n`;
  log += `Channel ID: ${ctx.channelId}\n`;
  log += `Depth: ${ctx.depth}\n`;
  if (completedAt) log += `Completed At: ${completedAt}\n`;
  if (error) log += `Error: ${error}\n`;
  log += "\n--- INPUT ---\n";
  log += `Instructions:\n${ctx.instructions}\n\n`;
  log += `Full Input:\n${ctx.input}\n\n`;
  log += "--- OUTPUT ---\n";
  log += `${output}\n\n`;
  log += "========================================\n";
  return log;
};

const formatErrorLog = (
  agentId: string,
  channelId: string,
  depth: number,
  error: Error,
  agentName: string,
): string => {
  let log = "========================================\n";
  log += "AGENT LOG ENTRY (ERROR)\n";
  log += "========================================\n\n";
  log += `Timestamp: ${new Date().toISOString()}\n`;
  log += `Agent ID: ${agentId}\n`;
  log += `Agent Name: ${agentName}\n`;
  log += `Channel ID: ${channelId}\n`;
  log += `Depth: ${depth}\n`;
  log += `Error: ${error.message}\n`;
  if (error.stack) log += `\nStack Trace:\n${error.stack}\n`;
  log += "\n========================================\n";
  return log;
};

const applyStreamEvent = (acc: string, ev: any) => {
  switch (ev?.type) {
    case "text-delta":
      return acc + (ev.payload?.text ?? "");
    case "tool-result": {
      const name = ev.payload?.toolName ?? "tool";
      const result = ev.payload?.result;
      let next = `${acc}\n\n*Tool Result: ${name}*`;
      if (result && typeof result === "string" && result.length > 0) {
        const snippet =
          result.length > 200 ? `${result.substring(0, 200)}...` : result;
        next += `\n${snippet}`;
      }
      return next;
    }
    case "reasoning-delta": {
      const t = ev.payload?.text ?? "";
      return t ? acc + t : acc;
    }
    case "text-end":
    case "step-finish":
      return `${acc}\n\n`;
    case "tool-output":
      return `${acc}\n\n*Tool Call Complete: ${
        ev.payload?.toolName ?? "tool"
      }*`;
    case "tool-call-input-streaming-start":
      return `${acc}\n\n*Tool Call: ${ev.payload?.toolName ?? "tool"}*`;
    case "error":
      return `${acc}\n\n[Error: ${ev.payload?.message || "Unknown error"}]`;
    default:
      return acc;
  }
};

const resolveMentionedAgentIds = (
  acc: string,
  agentRows: { id: string; name: string }[],
): string[] => {
  const mentioned = new Set(
    Array.from(acc.matchAll(/@([a-z0-9_]+)/gi)).map((m) => m[1].toLowerCase()),
  );
  if (!mentioned.size) return [];
  const ids: string[] = [];
  for (const row of agentRows) {
    if (mentioned.has(row.name.toLowerCase())) ids.push(row.id);
  }
  return ids;
};

const buildMockResponse = (
  agentName: string,
  userMessage: string,
  triggeringUsername: string,
) => {
  const mention = triggeringUsername ? `@${triggeringUsername} ` : "";
  const snippet = userMessage.trim().slice(0, 200);
  return `${mention}${agentName} (mock): ${snippet || "Hello"}.`;
};

export const processAgentResponse = async (
  channelId: string,
  agentId: string,
  agentMessageId: string,
  userMessage: string,
  triggeringUsername: string,
  depth: number = 0,
) => {
  const updateMessage = (content: string) =>
    query(`UPDATE messages SET content = $1 WHERE id = $2`, [
      content,
      agentMessageId,
    ]);

  try {
    console.log("[agent] Processing agent response", { agentId, depth });
    if (depth >= maxDepth) {
      await updateMessage("Maximum collaboration depth reached (5).");
      return { success: true, agentMessageId };
    }

    const agentInfo = await query(
      `SELECT name, system_instructions, description FROM agents WHERE id = $1`,
      [agentId],
    );
    const agentName = agentInfo.rows[0]?.name || "Agent";
    const systemInstructions = agentInfo.rows[0]?.system_instructions || "";
    const agentDescription = agentInfo.rows[0]?.description || "";

    const channelAgents = await query(
      `SELECT a.id, a.name, a.description
       FROM agents a
       JOIN channel_members cm ON cm.member_id = a.id::text AND cm.member_type = 'agent'
       WHERE cm.channel_id = $1 AND a.id::text != $2
       ORDER BY a.name`,
      [channelId, agentId],
    );

    const channelDocuments = await query(
      `SELECT id, title, description
       FROM documents
       WHERE channel_id = $1
       ORDER BY created_at DESC`,
      [channelId],
    );

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

    const agentContext = buildAgentContext(
      channelAgents.rows || [],
      channelDocuments.rows || [],
    );
    const history = buildHistory(messages.rows || []);
    const input = `Channel: ${channelId}\n${history}\nUser: ${userMessage}`;

    let instructions =
      systemInstructions || "You are a helpful assistant in a chat channel.";
    instructions += `\n\nYou are ${agentName}`;
    if (agentDescription) instructions += `: ${agentDescription}`;
    instructions += ".";
    if (triggeringUsername) {
      instructions += ` Always mention the user who triggered you by using @${triggeringUsername} in your response.`;
    }
    instructions += agentContext;
    if (channelDocuments.rows.length || channelAgents.rows.length) {
      instructions += `\n\nChannel ID: ${channelId} (use this when calling document tools)`;
    }

    const logDir = join(process.cwd(), "logs");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFile = join(
      logDir,
      `agent-${sanitizeName(agentName)}-${timestamp}.log`,
    );
    await mkdir(logDir, { recursive: true }).catch(() => {});

    const logContext = {
      agentId,
      agentName,
      channelId,
      depth,
      instructions,
      input,
    };
    await writeFile(logFile, formatLogEntry(logContext, ""));

    let acc = "";
    const mock =
      process.env.MOCK_LLM === "1" || process.env.AI_MODEL === "mock";
    if (mock) {
      acc = buildMockResponse(agentName, userMessage, triggeringUsername);
      await updateMessage(acc);
      await writeFile(
        logFile,
        formatLogEntry(logContext, acc, undefined, new Date().toISOString()),
      );
    } else {
      const agent = new Agent({
        name: agentName,
        instructions,
        model: process.env.AI_MODEL || defaultModel,
        tools: {
          listDocuments,
          createDocument,
          readDocument,
        },
      });

      try {
        const stream = await agent.stream(input);
        for await (const ev of stream.fullStream) {
          acc = applyStreamEvent(acc, ev);
          if (acc) await updateMessage(acc);
        }
      } catch (streamError: any) {
        acc += `\n\n[Error: ${
          streamError.message || "Stream processing failed"
        }]`;
        await updateMessage(acc);
        await writeFile(
          logFile,
          formatLogEntry(
            logContext,
            acc,
            streamError.message,
            new Date().toISOString(),
          ),
        );
        throw streamError;
      }

      await writeFile(
        logFile,
        formatLogEntry(logContext, acc, undefined, new Date().toISOString()),
      );
    }

    const mentionedAgentIds = resolveMentionedAgentIds(
      acc,
      channelAgents.rows || [],
    );
    if (mentionedAgentIds.length > 0) {
      console.log("[agent] Triggering mentioned agents", mentionedAgentIds);
      await Promise.all(
        mentionedAgentIds.map(async (mentionedAgentId) => {
          const newAgentMessageId = crypto.randomUUID();
          const agentMessageCreatedAt = new Date().toISOString();
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
          return processAgentResponse(
            channelId,
            mentionedAgentId,
            newAgentMessageId,
            acc,
            agentName,
            depth + 1,
          );
        }),
      );
    }

    return { success: true, agentMessageId };
  } catch (error: any) {
    console.error("[agent] Failed to process agent response:", error);
    try {
      await updateMessage(`Error: ${error.message}`);
    } catch (dbError) {
      console.error("[agent] Failed to update error message:", dbError);
    }

    try {
      const logDir = join(process.cwd(), "logs");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const errorAgentInfo = await query(
        `SELECT name FROM agents WHERE id = $1`,
        [agentId],
      );
      const errorAgentName = errorAgentInfo.rows[0]?.name || "unknown";
      const logFile = join(
        logDir,
        `agent-${sanitizeName(errorAgentName)}-${timestamp}.log`,
      );
      await writeFile(
        logFile,
        formatErrorLog(agentId, channelId, depth, error, errorAgentName),
      );
    } catch (logError) {
      console.error("[agent] Failed to write error log file:", logError);
    }

    return { success: false, error: error.message };
  }
};
