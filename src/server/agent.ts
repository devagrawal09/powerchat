"use server";
import { Agent } from "@mastra/core/agent";
import type { MessageListInput } from "@mastra/core/agent/message-list";

// Create Mastra agent
const agent = new Agent({
  name: "channel-assistant",
  instructions: "You are a helpful assistant in a chat channel.",
  model: process.env.AI_MODEL || "openai/gpt-5",
});

export const streamAgent = async (input: string) => {
  const stream = await agent.stream(input);
  return stream.textStream;
};
