"use server";

import { SignJWT } from "jose";
import { getCookie } from "vinxi/http";
import { getRequestEvent } from "solid-js/web";
import { query } from "./db";
import { UpdateType, CrudEntry } from "@powersync/common";

// Token generation for PowerSync authentication
export async function getPowerSyncToken() {
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const userId = getCookie(event.nativeEvent, "pc_uid");
  if (!userId) throw new Error("No session");

  const secret = process.env.POWERSYNC_JWT_SECRET;
  if (!secret) throw new Error("POWERSYNC_JWT_SECRET is not set");

  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(secret));

  return {
    token: jwt,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}

// Upload data from PowerSync client to Neon
export async function uploadData(transactions: CrudEntry[]) {
  try {
    // Process synchronously - DO NOT queue for later per PowerSync docs
    for (const op of transactions) {
      const { op: opType, table: tableName, id, opData } = op;

      switch (opType) {
        case UpdateType.PUT:
          // INSERT or UPSERT (create new row)
          if (!opData) throw new Error("PUT requires data");
          const putCols = Object.keys(opData);
          const putVals = Object.values(opData);
          await query(
            `INSERT INTO ${tableName} (id, ${putCols.join(", ")}) 
             VALUES ($1, ${putCols.map((_, i) => `$${i + 2}`).join(", ")})
             ON CONFLICT (id) DO UPDATE SET 
             ${putCols.map((k) => `${k} = EXCLUDED.${k}`).join(", ")}`,
            [id, ...putVals]
          );
          break;

        case UpdateType.PATCH:
          // UPDATE existing row
          if (!opData) throw new Error("PATCH requires data");
          const patchCols = Object.keys(opData);
          const patchVals = Object.values(opData);
          await query(
            `UPDATE ${tableName} 
             SET ${patchCols.map((k, i) => `${k} = $${i + 2}`).join(", ")}
             WHERE id = $1`,
            [id, ...patchVals]
          );
          break;

        case UpdateType.DELETE:
          // DELETE existing row
          await query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
          break;
      }
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Upload error:", error);
    throw error; // Let PowerSync retry
  }
}
