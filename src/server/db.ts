import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { serverSchema } from "~/db/schema/server";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export const db = drizzle({
  client: getPool(),
  schema: serverSchema,
});

export async function queryInternal(text: string, params?: unknown[]) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: unknown[]) {
  "use server";
  return queryInternal(text, params);
}
