import { action } from "@solidjs/router";
import { query, getOne } from "./db";
import { getCookie, setCookie } from "vinxi/http";
import { getRequestEvent } from "solid-js/web";

function getUsername(): string {
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");
  const username = getCookie(event.nativeEvent, "pc_username");
  if (!username) throw new Error("No session");
  return username;
}

export const registerUsername = action(async (formData: FormData) => {
  "use server";
  const username = ((formData.get("username") as string) || "").trim();

  // Validate username format
  if (username.length < 3 || username.length > 30) {
    return { error: "Username must be 3-30 characters" };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      error:
        "Username can only contain letters, numbers, hyphens, and underscores",
    };
  }

  // Check for duplicates
  const existing = await getOne<{ id: string }>(
    `SELECT id FROM users WHERE id = $1`,
    [username]
  );

  if (existing) {
    return { error: "Username already taken" };
  }

  // Insert new user
  try {
    await query(`INSERT INTO users (id, created_at) VALUES ($1, now())`, [
      username,
    ]);

    // Set cookie in response
    const event = getRequestEvent();
    if (event) {
      setCookie(event.nativeEvent, "pc_username", username, {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 12 months
      });
    }

    return { success: true, username };
  } catch (error: any) {
    return { error: error.message || "Failed to create user" };
  }
}, "registerUsername");

export const createChannel = action(async (formData: FormData) => {
  "use server";
  const username = getUsername();
  const name = formData.get("name") as string;

  if (!name || name.length < 2) {
    return { error: "Channel name must be at least 2 characters" };
  }

  // Create channel
  const channelResult = await query(
    `INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id`,
    [name, username]
  );
  const channelId = channelResult.rows[0].id;

  // Add creator as member
  await query(
    `INSERT INTO channel_members (channel_id, member_type, member_id) VALUES ($1, 'user', $2)`,
    [channelId, username]
  );

  return { success: true, channelId };
}, "createChannel");

export const inviteByUsername = action(async (formData: FormData) => {
  "use server";
  const channelId = formData.get("channelId") as string;
  const username = ((formData.get("username") as string) || "").trim();

  if (!channelId || !username) {
    return { error: "Missing required fields" };
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

export const postMessage = action(async (formData: FormData) => {
  "use server";
  const username = getUsername();
  const channelId = formData.get("channelId") as string;
  const content = formData.get("content") as string;

  if (!channelId || !content || content.trim().length === 0) {
    return { error: "Missing required fields" };
  }

  // Insert message
  const messageResult = await query(
    `INSERT INTO messages (channel_id, author_type, author_id, content) VALUES ($1, 'user', $2, $3) RETURNING id`,
    [channelId, username, content]
  );
  const messageId = messageResult.rows[0].id;

  return { success: true, messageId, channelId, content };
}, "postMessage");
