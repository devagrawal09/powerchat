import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { serverSchema } from "~/db/schema/server";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
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
