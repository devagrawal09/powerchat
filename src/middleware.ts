import { createMiddleware } from "@solidjs/start/middleware";
import { getCookie, setCookie } from "vinxi/http";
import { getOne, queryInternal } from "~/server/db";

async function ensureAnonymousUser(event: any) {
  const existing = getCookie(event.nativeEvent, "pc_uid");
  if (!existing) {
    // Try to claim an unclaimed user from the pool
    const unclaimed = await getOne<{ id: string }>(
      `SELECT id FROM users 
       WHERE claimed_at IS NULL 
       AND id BETWEEN '00000000-0000-0000-0000-000000000001' AND '00000000-0000-0000-0000-000000000010'
       ORDER BY id 
       LIMIT 1 
       FOR UPDATE SKIP LOCKED`
    );

    let uid: string;
    if (unclaimed) {
      // Claim this user
      uid = unclaimed.id;
      await queryInternal(`UPDATE users SET claimed_at = now() WHERE id = $1`, [
        uid,
      ]);
    } else {
      // All pre-seeded users are claimed, generate a new UUID
      uid = crypto.randomUUID();
      // Insert as a new user
      await queryInternal(
        `INSERT INTO users (id, display_name, created_at, claimed_at) 
         VALUES ($1, 'Anonymous', now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [uid]
      );
    }

    setCookie(event.nativeEvent, "pc_uid", uid, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 12 months
    });
  }
}

export default createMiddleware({
  onRequest: async (event) => {
    await ensureAnonymousUser(event);
  },
});
