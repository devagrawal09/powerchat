"use server";
import { Agent } from "@mastra/core/agent";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  agentRuns as agentRunsTable,
  agents as agentsTable,
  messages as messagesTable,
  users as usersTable,
} from "~/db/schema/server";
import { db } from "./db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

type LogContext = {
  agentId: string;
  agentName: string;
  channelId: string;
  instructions: string;
  input: string;
};

const defaultModel = "openrouter/anthropic/claude-haiku-4.5";

const sanitizeName = (name: string) =>
  name.replace(/[^a-z0-9]/gi, "-").toLowerCase();

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
  log += `Error: ${error.message}\n`;
  if (error.stack) log += `\nStack Trace:\n${error.stack}\n`;
  log += "\n========================================\n";
  return log;
};

/** Build a trace line from a stream event (for the trace panel) */
const buildTraceLine = (ev: any): string | null => {
  switch (ev?.type) {
    case "text-delta":
      return ev.payload?.text ?? null;
    case "tool-call-input-streaming-start":
      return `\n\n**Tool Call: ${ev.payload?.toolName ?? "tool"}**\n`;
    case "tool-result": {
      const name = ev.payload?.toolName ?? "tool";
      const result = ev.payload?.result;
      let line = `\n\n**Tool Result: ${name}**`;
      if (result && typeof result === "string" && result.length > 0) {
        const snippet =
          result.length > 200 ? `${result.substring(0, 200)}...` : result;
        line += `\n${snippet}`;
      }
      return line;
    }
    case "tool-output":
      return `\n\n*Tool Call Complete: ${ev.payload?.toolName ?? "tool"}*`;
    case "reasoning-delta": {
      const t = ev.payload?.text ?? "";
      return t || null;
    }
    case "text-end":
    case "step-finish":
      return "\n\n";
    case "error":
      return `\n\n[Error: ${ev.payload?.message || "Unknown error"}]`;
    default:
      return null;
  }
};

/** Extract only the final text output (no tool calls/reasoning) from stream events */
const applyFinalTextEvent = (acc: string, ev: any): string => {
  switch (ev?.type) {
    case "text-delta":
      return acc + (ev.payload?.text ?? "");
    case "text-end":
    case "step-finish":
      return `${acc}\n\n`;
    default:
      return acc;
  }
};

// Global registry of active agent run abort controllers
const activeRuns = new Map<string, AbortController>();

export function stopAgentRun(runId: string): boolean {
  const controller = activeRuns.get(runId);
  if (controller) {
    controller.abort();
    activeRuns.delete(runId);
    return true;
  }
  return false;
}

export const processAgentResponse = async (
  channelId: string,
  agentId: string,
  agentMessageId: string,
  agentRunId: string,
  userMessage: string,
  triggeringUsername: string,
) => {
  const updateMessage = (content: string) =>
    db
      .update(messagesTable)
      .set({ content })
      .where(eq(messagesTable.id, agentMessageId));

  const updateTrace = (trace: string) =>
    db
      .update(agentRunsTable)
      .set({ trace })
      .where(eq(agentRunsTable.id, agentRunId));

  const completeRun = (status: string, error?: string) =>
    db
      .update(agentRunsTable)
      .set({
        status,
        error: error || null,
        completedAt: new Date().toISOString(),
      })
      .where(eq(agentRunsTable.id, agentRunId));

  try {
    console.log("[agent] Processing agent response", { agentId, agentRunId });

    const agentInfo = await db
      .select({
        name: agentsTable.name,
        system_instructions: agentsTable.systemInstructions,
        description: agentsTable.description,
      })
      .from(agentsTable)
      .where(eq(agentsTable.id, agentId))
      .limit(1);
    const agentName = agentInfo[0]?.name || "Agent";
    const systemInstructions = agentInfo[0]?.system_instructions || "";
    const agentDescription = agentInfo[0]?.description || "";

    const messages = await db
      .select({
        author_type: messagesTable.authorType,
        content: messagesTable.content,
        author_name: sql<string>`case
          when ${messagesTable.authorType} = 'user' then ${usersTable.id}
          when ${messagesTable.authorType} = 'agent' then ${agentsTable.name}
          when ${messagesTable.authorType} = 'system' then 'System'
        end`,
      })
      .from(messagesTable)
      .leftJoin(
        usersTable,
        and(
          eq(messagesTable.authorType, "user"),
          eq(usersTable.id, messagesTable.authorId),
        ),
      )
      .leftJoin(
        agentsTable,
        sql`${messagesTable.authorType} = 'agent' and ${messagesTable.authorId} = ${agentsTable.id}::text`,
      )
      .where(eq(messagesTable.channelId, channelId))
      .orderBy(asc(messagesTable.createdAt), asc(messagesTable.id))
      .limit(30);

    const history = buildHistory(messages || []);
    const input = `Channel: ${channelId}\n${history}\nUser: ${userMessage}`;

    let instructions =
      systemInstructions || "You are a helpful assistant in a chat channel.";
    instructions += `\n\nYou are ${agentName}`;
    if (agentDescription) instructions += `: ${agentDescription}`;
    instructions += ".";
    if (triggeringUsername) {
      instructions += ` Always mention the user who triggered you by using @${triggeringUsername} in your response.`;
    }
    instructions += `\n\nYou have access to a workspace with file storage, search, and command execution capabilities. Use the workspace tools to read, write, and search files in this channel's workspace.`;

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
      instructions,
      input,
    };
    await writeFile(logFile, formatLogEntry(logContext, ""));

    let trace = "";
    let finalText = "";
    const abortController = new AbortController();
    activeRuns.set(agentRunId, abortController);

    const agent = new Agent({
      name: agentName,
      instructions,
      model: process.env.AI_MODEL || defaultModel,
      id: "agent",
    });

    try {
      const stream = await agent.stream(input, {
        abortSignal: abortController.signal,
      });

      let traceUpdatePending = false;

      for await (const ev of stream.fullStream) {
        if (abortController.signal.aborted) {
          break;
        }

        // Build trace (all events)
        const traceLine = buildTraceLine(ev);
        if (traceLine) {
          trace += traceLine;
          // Batch trace updates - don't write every single delta
          if (!traceUpdatePending) {
            traceUpdatePending = true;
            setTimeout(async () => {
              traceUpdatePending = false;
              await updateTrace(trace).catch(() => {});
            }, 300);
          }
        }

        // Build final text (only text deltas, no tool calls)
        finalText = applyFinalTextEvent(finalText, ev);

        // Update message with "Thinking..." while tools are being used,
        // or with partial final text if we have some
        if (finalText.trim()) {
          await updateMessage(finalText);
        }
      }

      // Final trace flush
      await updateTrace(trace);

      if (abortController.signal.aborted) {
        await updateMessage(finalText.trim() || "*(Agent stopped)*");
        await completeRun("stopped");
      } else {
        await updateMessage(finalText.trim() || "*(No response)*");
        await completeRun("completed");
      }
    } catch (streamError: any) {
      if (streamError.name === "AbortError") {
        await updateMessage(finalText.trim() || "*(Agent stopped)*");
        await completeRun("stopped");
      } else {
        finalText += `\n\n[Error: ${
          streamError.message || "Stream processing failed"
        }]`;
        await updateMessage(finalText);
        await updateTrace(trace + `\n\n[Error: ${streamError.message}]`);
        await completeRun("error", streamError.message);
        await writeFile(
          logFile,
          formatLogEntry(
            logContext,
            trace,
            streamError.message,
            new Date().toISOString(),
          ),
        );
        throw streamError;
      }
    } finally {
      activeRuns.delete(agentRunId);
    }

    await writeFile(
      logFile,
      formatLogEntry(logContext, trace, undefined, new Date().toISOString()),
    );

    return { success: true, agentMessageId };
  } catch (error: any) {
    console.error("[agent] Failed to process agent response:", error);
    try {
      await updateMessage(`Error: ${error.message}`);
    } catch (dbError) {
      console.error("[agent] Failed to update error message:", dbError);
    }

    try {
      await completeRun("error", error.message);
    } catch (runError) {
      console.error("[agent] Failed to update agent run:", runError);
    }

    try {
      const logDir = join(process.cwd(), "logs");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const errorAgentInfo = await db
        .select({ name: agentsTable.name })
        .from(agentsTable)
        .where(eq(agentsTable.id, agentId))
        .limit(1);
      const errorAgentName = errorAgentInfo[0]?.name || "unknown";
      const logFile = join(
        logDir,
        `agent-${sanitizeName(errorAgentName)}-${timestamp}.log`,
      );
      await writeFile(
        logFile,
        formatErrorLog(agentId, channelId, error, errorAgentName),
      );
    } catch (logError) {
      console.error("[agent] Failed to write error log file:", logError);
    }

    return { success: false, error: error.message };
  }
};
