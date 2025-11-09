import { action } from "@solidjs/router";
import { query, getOne } from "~/server/db";
import { getUsername } from "~/server/utils";

export const inviteByUsername = action(async (formData: FormData) => {
  "use server";
  const currentUser = getUsername();
  const channelId = formData.get("channelId") as string;
  const username = ((formData.get("username") as string) || "").trim();

  if (!channelId || !username) {
    return { error: "Missing required fields" };
  }

  // Verify current user is a member of the channel
  const isMember = await getOne<{ exists: boolean }>(
    `SELECT 1 as exists FROM channel_members 
     WHERE channel_id = $1 AND member_type = 'user' AND member_id = $2`,
    [channelId, currentUser]
  );

  if (!isMember) {
    return { error: "You must be a member of this channel to invite users" };
  }

  // Check if user exists
  const userExists = await getOne<{ id: string }>(
    `SELECT id FROM users WHERE id = $1`,
    [username]
  );

  if (!userExists) {
    return { error: "User not found" };
  }

  // Add user to channel
  try {
    await query(
      `INSERT INTO channel_members (channel_id, member_type, member_id) VALUES ($1, 'user', $2) ON CONFLICT DO NOTHING`,
      [channelId, username]
    );
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to add user to channel" };
  }
}, "inviteByUsername");

export const inviteAgent = action(async (formData: FormData) => {
  "use server";
  const currentUser = getUsername();
  const channelId = formData.get("channelId") as string;
  const agentId = formData.get("agentId") as string;

  if (!channelId || !agentId) {
    return { error: "Missing required fields" };
  }

  // Verify current user is a member of the channel
  const isMember = await getOne<{ exists: boolean }>(
    `SELECT 1 as exists FROM channel_members 
     WHERE channel_id = $1 AND member_type = 'user' AND member_id = $2`,
    [channelId, currentUser]
  );

  if (!isMember) {
    return { error: "You must be a member of this channel to invite agents" };
  }

  // Check if agent exists
  const agentExists = await getOne<{ id: string }>(
    `SELECT id FROM agents WHERE id = $1`,
    [agentId]
  );

  if (!agentExists) {
    return { error: "Agent not found" };
  }

  // Add agent to channel
  try {
    await query(
      `INSERT INTO channel_members (channel_id, member_type, member_id) VALUES ($1, 'agent', $2) ON CONFLICT DO NOTHING`,
      [channelId, agentId]
    );
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to add agent to channel" };
  }
}, "inviteAgent");
