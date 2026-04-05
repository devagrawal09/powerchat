"use server";

import { Agent } from "@mastra/core/agent";
import { and, asc, eq, sql } from "drizzle-orm";
import { agentRuns, agents, messages, users } from "~/db/schema/server";
import { db } from "./db";

const defaultModel = "openrouter/anthropic/claude-haiku-4.5";

type MessageHistoryRow = {
  author_type: string;
  author_name: string;
  content: string;
};

function buildHistory(rows: MessageHistoryRow[]) {
  return rows
    .map((message) => ({
      role: message.author_type === "user" ? "user" : "assistant",
      name: message.author_name,
      content: message.content,
    }))
    .map((message) => JSON.stringify(message, null, 2))
    .join("\n");
}

function buildInstructions(
  agentName: string,
  systemInstructions: string,
  agentDescription: string,
  triggeringUsername: string,
) {
  let instructions =
    systemInstructions || "You are a helpful assistant in a chat channel.";

  instructions += `\n\nYou are ${agentName}`;
  if (agentDescription) {
    instructions += `: ${agentDescription}`;
  }
  instructions += ".";

  if (triggeringUsername) {
    instructions += ` Always mention the user who triggered you by using @${triggeringUsername} in your response.`;
  }

  instructions +=
    "\n\nYou have access to a workspace with file storage, search, and command execution capabilities. Use the workspace tools to read, write, and search files in this channel's workspace.";

  return instructions;
}

async function loadAgentDetails(agentId: string) {
  const rows = await db
    .select({
      name: agents.name,
      systemInstructions: agents.systemInstructions,
      description: agents.description,
    })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  return rows[0];
}

async function loadChannelHistory(channelId: string) {
  return db
    .select({
      author_type: messages.authorType,
      content: messages.content,
      author_name: sql<string>`case
        when ${messages.authorType} = 'user' then ${users.id}
        when ${messages.authorType} = 'agent' then ${agents.name}
        else 'System'
      end`,
    })
    .from(messages)
    .leftJoin(
      users,
      and(eq(messages.authorType, "user"), eq(users.id, messages.authorId)),
    )
    .leftJoin(
      agents,
      sql`${messages.authorType} = 'agent' and ${messages.authorId} = ${agents.id}::text`,
    )
    .where(eq(messages.channelId, channelId))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .limit(30);
}

function createAgentInput(
  channelId: string,
  history: MessageHistoryRow[],
  userMessage: string,
) {
  return `Channel: ${channelId}\n${buildHistory(history)}\nUser: ${userMessage}`;
}

async function updateAgentMessage(agentMessageId: string, content: string) {
  await db
    .update(messages)
    .set({ content })
    .where(eq(messages.id, agentMessageId));
}

async function completeAgentRun(
  agentRunId: string,
  status: "completed" | "error",
  error?: string,
) {
  await db
    .update(agentRuns)
    .set({
      status,
      error: error || null,
      completedAt: new Date().toISOString(),
    })
    .where(eq(agentRuns.id, agentRunId));
}

async function streamAgentText(
  agent: Agent,
  input: string,
  onText: (text: string) => Promise<void>,
) {
  const stream = await agent.stream(input);
  let finalText = "";
  let chunksSinceFlush = 0;
  let lastFlushedText = "";

  async function flushIfNeeded(force = false) {
    if (!finalText.trim()) return;
    if (!force && chunksSinceFlush < 20 && !finalText.endsWith("\n")) return;
    if (finalText === lastFlushedText) return;

    await onText(finalText);
    lastFlushedText = finalText;
    chunksSinceFlush = 0;
  }

  for await (const event of stream.fullStream) {
    if (event?.type === "text-delta") {
      finalText += event.payload?.text ?? "";
      chunksSinceFlush += 1;
      await flushIfNeeded();
    }

    if (event?.type === "text-end" || event?.type === "step-finish") {
      finalText += "\n\n";
      await flushIfNeeded();
    }
  }

  await flushIfNeeded(true);

  return finalText.trim() || "*(No response)*";
}

export async function processAgentResponse(
  channelId: string,
  agentId: string,
  agentMessageId: string,
  agentRunId: string,
  userMessage: string,
  triggeringUsername: string,
) {
  try {
    const agentDetails = await loadAgentDetails(agentId);
    const agentName = agentDetails?.name || "Agent";
    const instructions = buildInstructions(
      agentName,
      agentDetails?.systemInstructions || "",
      agentDetails?.description || "",
      triggeringUsername,
    );
    const history = await loadChannelHistory(channelId);
    const input = createAgentInput(channelId, history, userMessage);

    const agent = new Agent({
      id: "agent",
      name: agentName,
      instructions,
      model: process.env.AI_MODEL || defaultModel,
    });

    const finalText = await streamAgentText(
      agent,
      input,
      async (partialText) => {
        await updateAgentMessage(agentMessageId, partialText);
      },
    );

    await updateAgentMessage(agentMessageId, finalText);
    await completeAgentRun(agentRunId, "completed");

    return { success: true, agentMessageId };
  } catch (error: any) {
    console.error("[agent] Failed to process agent response:", error);

    try {
      await updateAgentMessage(agentMessageId, `Error: ${error.message}`);
    } catch (messageError) {
      console.error("[agent] Failed to update error message:", messageError);
    }

    try {
      await completeAgentRun(agentRunId, "error", error.message);
    } catch (runError) {
      console.error("[agent] Failed to update agent run:", runError);
    }

    return { success: false, error: error.message };
  }
}
