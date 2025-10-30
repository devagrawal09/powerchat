import { action } from "@solidjs/router";
import { query, getOne } from "./db";
import { getCookie } from "vinxi/http";
import { getRequestEvent } from "solid-js/web";
import { triggerAgent } from "./agent";

function getUserId(): string {
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");
  const userId = getCookie(event.nativeEvent, "pc_uid");
  if (!userId) throw new Error("No session");
  return userId;
}

export const createChannel = action(async (formData: FormData) => {
  "use server";
  const userId = getUserId();
  const name = formData.get("name") as string;

  if (!name || name.length < 2) {
    return { error: "Channel name must be at least 2 characters" };
  }

  // Ensure user exists
  await query(
    `INSERT INTO users (id, display_name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [userId, "Anonymous"]
  );

  // Create channel
  const channelResult = await query(
    `INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id`,
    [name, userId]
  );
  const channelId = channelResult.rows[0].id;

  // Add creator as member
  await query(
    `INSERT INTO channel_members (channel_id, member_type, member_id) VALUES ($1, 'user', $2)`,
    [channelId, userId]
  );

  return { success: true, channelId };
}, "createChannel");

export const inviteMember = action(async (formData: FormData) => {
  "use server";
  const channelId = formData.get("channelId") as string;
  const memberType = formData.get("memberType") as string;
  const memberId = formData.get("memberId") as string;

  if (!channelId || !memberType || !memberId) {
    return { error: "Missing required fields" };
  }

  await query(
    `INSERT INTO channel_members (channel_id, member_type, member_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [channelId, memberType, memberId]
  );

  return { success: true };
}, "inviteMember");

export const postMessage = action(async (formData: FormData) => {
  "use server";
  const userId = getUserId();
  const channelId = formData.get("channelId") as string;
  const content = formData.get("content") as string;

  if (!channelId || !content || content.trim().length === 0) {
    return { error: "Missing required fields" };
  }

  // Ensure user exists
  await query(
    `INSERT INTO users (id, display_name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [userId, "Anonymous"]
  );

  // Insert message
  const messageResult = await query(
    `INSERT INTO messages (channel_id, author_type, author_id, content) VALUES ($1, 'user', $2, $3) RETURNING id`,
    [channelId, userId, content]
  );
  const messageId = messageResult.rows[0].id;

  return { success: true, messageId, channelId, content };
}, "postMessage");
