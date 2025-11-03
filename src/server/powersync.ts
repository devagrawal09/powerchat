"use server";

import { SignJWT } from "jose";
import { getCookie } from "vinxi/http";
import { getRequestEvent } from "solid-js/web";
import { query } from "./db";
import { UpdateType } from "@powersync/common";

// Token generation for PowerSync authentication
export async function getPowerSyncToken() {
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const userId = getCookie(event.nativeEvent, "pc_uid");
  if (!userId) throw new Error("No session");

  const secret = process.env.POWERSYNC_JWT_SECRET;
  if (!secret) throw new Error("POWERSYNC_JWT_SECRET is not set");

  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256", kid: "powerchat" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(secret));

  return {
    token: `eyJhbGciOiJSUzI1NiIsImtpZCI6InBvd2Vyc3luYy1kZXYtMzIyM2Q0ZTMifQ.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDIiLCJpYXQiOjE3NjIxNTQ1NzAsImlzcyI6Imh0dHBzOi8vcG93ZXJzeW5jLWFwaS5qb3VybmV5YXBwcy5jb20iLCJhdWQiOiJodHRwczovLzY5MDBhOWM0OTZhMmZmNGZkOTg4OWQ2OC5wb3dlcnN5bmMuam91cm5leWFwcHMuY29tIiwiZXhwIjoxNzYyMTk3NzcwfQ.ebur__vuNjkIdTKNgriPMJ9aAi7xZnEBwimd_dWvONEaWcdG9mAUTdsSqnUPWdXBrmEKHDgk4Aj8ZJgMKxStRwTBOHLx0tBNwc_XpUuChYa9REuMmXLs0YGvNh8P14ZDtfZUalmMq8c204szornwvAkZNXtE-32RempHIiq0APm8HHEp5retXV3H2HFIgydRGL2FVP9v_C1XcIUgj0I4apzxPFKAKlu0xcitoOkF5lRAAYYh_kmxMi3CvbgBx-zn50M3s6Z6Q2fC2Rgsfl8HeQX2Gem_5_BMCEfF2ZUl72_zda-enN-1JHP45KcqBqfrWfisRxygHw_6hBm-PUdEBQ`,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
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
  console.log("[PowerSync] [SERVER] uploadData called with", transactions);
  try {
    // Process synchronously - DO NOT queue for later per PowerSync docs
    for (const op of transactions) {
      const { op: opType, table: tableName, id, opData } = op;
      console.log(`[PowerSync] [SERVER] Processing`, {
        opType,
        tableName,
        id,
        opData,
      });

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
  } catch (error: unknown) {
    console.error("Upload error:", error);
    throw error; // Let PowerSync retry
  }
}
