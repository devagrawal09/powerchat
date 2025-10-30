"use server";
import { Pool } from "pg";

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

export async function query(text: string, params?: any[]) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function getOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await query(text, params);
  return result.rows[0] || null;
}

export async function getMany<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await query(text, params);
  return result.rows;
}
