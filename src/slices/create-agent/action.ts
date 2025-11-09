import { action } from "@solidjs/router";
import { query, getOne } from "~/server/db";

export const createAgent = action(async (formData: FormData) => {
  "use server";
  const name = ((formData.get("name") as string) || "").trim();
  const systemInstructions =
    (formData.get("system_instructions") as string) || "";
  const description = (formData.get("description") as string) || "";

  if (!name || name.length < 2) {
    return { error: "Agent name must be at least 2 characters" };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return {
      error:
        "Agent name can only contain letters, numbers, hyphens, and underscores",
    };
  }

  if (!systemInstructions.trim()) {
    return { error: "System instructions are required" };
  }

  if (!description.trim()) {
    return { error: "Description is required" };
  }

  // Check for duplicate agent name
  const existing = await getOne<{ id: string }>(
    `SELECT id FROM agents WHERE name = $1`,
    [name]
  );

  if (existing) {
    return { error: "Agent name already taken" };
  }

  // Create agent
  try {
    const agentResult = await query(
      `INSERT INTO agents (name, system_instructions, description, model_config) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, systemInstructions, description, JSON.stringify({})]
    );
    const agentId = agentResult.rows[0].id;

    return { success: true, agentId };
  } catch (error: any) {
    return { error: error.message || "Failed to create agent" };
  }
}, "createAgent");
