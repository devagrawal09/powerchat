"use server";

import { SignJWT } from "jose";
import { getRequestUsername } from "./request-auth";

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

export async function getPowerSyncToken() {
  const username = getRequestUsername();

  const kid = process.env.POWERSYNC_JWT_KID;
  const secretB64url = process.env.POWERSYNC_JWT_SECRET;
  const instanceUrl = process.env.POWERSYNC_SERVICE_URL;
  if (!kid || !secretB64url || !instanceUrl) {
    throw new Error(
      "POWERSYNC_JWT_KID, POWERSYNC_JWT_SECRET, or POWERSYNC_SERVICE_URL not set",
    );
  }

  const key = base64urlToBytes(secretB64url);

  const jwt = await new SignJWT({ sub: username, aud: instanceUrl })
    .setProtectedHeader({ alg: "HS256", kid })
    .setIssuedAt()
    .setExpirationTime("60m")
    .sign(key);

  return {
    token: jwt,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
}
