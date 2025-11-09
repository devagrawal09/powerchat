import { action } from "@solidjs/router";
import { query, getOne } from "~/server/db";
import { getCookie, setCookie } from "vinxi/http";
import { getRequestEvent } from "solid-js/web";

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
