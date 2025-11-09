"use server";

import { SignJWT } from "jose";
import { getCookie } from "vinxi/http";
import { getRequestEvent } from "solid-js/web";
import { query } from "./db";
import { UpdateType } from "@powersync/common";

// Helper to decode Base64URL safely
function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

// Token generation for PowerSync authentication
export async function getPowerSyncToken() {
  try {
    console.log("[getPowerSyncToken] getPowerSyncToken");
    const event = getRequestEvent();
    if (!event) throw new Error("No request event");

    const username = getCookie(event.nativeEvent, "pc_username");
    if (!username) throw new Error("No session");

    const kid = process.env.POWERSYNC_JWT_KID;
    const secretB64url = process.env.POWERSYNC_JWT_SECRET;
    if (!kid || !secretB64url)
      throw new Error("POWERSYNC_JWT_KID or POWERSYNC_JWT_SECRET not set");

    const key = base64urlToBytes(secretB64url);

    const jwt = await new SignJWT({ sub: username, aud: "powersync" })
      .setProtectedHeader({ alg: "HS256", kid })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(key);

    console.log("[getPowerSyncToken] jwt", jwt);
    console.log("[getPowerSyncToken] expiresAt", Date.now() + 15 * 60 * 1000);
    return {
      token: jwt,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
  } catch (error: any) {
    console.error("[getPowerSyncToken] error:", error);
    throw error;
  }
}

// Upload data from PowerSync client to Neon
export async function uploadData(
  transactions: {
    op: UpdateType;
    table: string;
    id: string;
    opData: Record<string, any>;
  }[]
) {
  console.log("[uploadData] transactions", transactions.length);

  try {
    // Process synchronously - DO NOT queue for later per PowerSync docs
    for (const op of transactions) {
      const { op: opType, table: tableName, id, opData } = op;

      switch (opType) {
        case UpdateType.PUT:
          // INSERT or UPSERT (create new row)
          if (!opData) throw new Error("PUT requires data");
          // Filter out 'id' from opData since it's already provided separately
          const putCols = Object.keys(opData).filter((k) => k !== "id");
          const putVals = putCols.map((k) => opData[k]);
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
          // Filter out 'id' from opData since it's already provided separately
          const patchCols = Object.keys(opData).filter((k) => k !== "id");
          const patchVals = patchCols.map((k) => opData[k]);
          if (!patchCols.length) break;
          await query(
            `UPDATE ${tableName} 
             SET ${patchCols.map((k, i) => `${k} = $${i + 1}`).join(", ")}
             WHERE id = $${patchCols.length + 1}`,
            [...patchVals, id]
          );
          break;

        case UpdateType.DELETE:
          // DELETE existing row
          await query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
          break;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("[uploadData] error:", error);
    // Return error as part of response instead of throwing
    return { success: false, error: error.message };
  }
}
