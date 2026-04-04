"use server";

import { and, eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { getCookie } from "vinxi/http";
import { getRequestEvent } from "solid-js/web";
import {
  channelMembers,
  channels,
  messages,
} from "~/db/schema/server";
import { db, query } from "./db";
import { UpdateType } from "@powersync/common";

type UploadOperation = {
  op: UpdateType;
  table: string;
  id: string;
  opData: Record<string, any>;
};

type AuthorizedOperation = {
  username: string;
  id: string;
  opType: UpdateType;
  opData: Record<string, any>;
};

type TableConfig = {
  columns: readonly string[];
  canPut: (op: AuthorizedOperation) => Promise<boolean>;
  canPatch: (op: AuthorizedOperation) => Promise<boolean>;
  canDelete: (op: AuthorizedOperation) => Promise<boolean>;
};

// Helper to decode Base64URL safely
function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function getRequestUsername(): string {
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");

  const username = getCookie(event.nativeEvent, "pc_username");
  if (!username) throw new Error("No session");

  return username;
}

async function isChannelMember(
  channelId: string | undefined,
  username: string,
): Promise<boolean> {
  if (!channelId) return false;

  const result = await db
    .select({ id: channelMembers.id })
    .from(channelMembers)
    .where(
      and(
        eq(channelMembers.channelId, channelId),
        eq(channelMembers.memberType, "user"),
        eq(channelMembers.memberId, username),
      ),
    )
    .limit(1);

  return result.length > 0;
}

async function isChannelCreator(
  channelId: string | undefined,
  username: string,
): Promise<boolean> {
  if (!channelId) return false;

  const result = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.createdBy, username)))
    .limit(1);

  return result.length > 0;
}

async function getMessageOwner(
  messageId: string,
): Promise<{
  author_type: string;
  author_id: string;
  channel_id: string;
} | null> {
  const result = await db
    .select({
      author_type: messages.authorType,
      author_id: messages.authorId,
      channel_id: messages.channelId,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  return result[0] ?? null;
}

async function getChannelMemberRow(memberRowId: string): Promise<{
  channel_id: string;
  member_type: string;
  member_id: string;
} | null> {
  const result = await db
    .select({
      channel_id: channelMembers.channelId,
      member_type: channelMembers.memberType,
      member_id: channelMembers.memberId,
    })
    .from(channelMembers)
    .where(eq(channelMembers.id, memberRowId))
    .limit(1);

  return result[0] ?? null;
}

function normalizeOpData(
  id: string,
  opData: Record<string, any> | null | undefined,
) {
  const normalized = { ...(opData ?? {}) };

  if (normalized.id != null && normalized.id !== id) {
    throw new Error("Payload id does not match operation id");
  }

  delete normalized.id;
  return normalized;
}

function validateColumns(
  table: string,
  allowedColumns: readonly string[],
  opData: Record<string, any>,
) {
  const allowed = new Set(allowedColumns);
  const columns = Object.keys(opData);
  const invalidColumns = columns.filter((column) => !allowed.has(column));

  if (invalidColumns.length > 0) {
    throw new Error(
      `Invalid columns for ${table}: ${invalidColumns.join(", ")}`,
    );
  }

  return columns;
}

function getOperationLabel(op: UpdateType): string {
  switch (op) {
    case UpdateType.PUT:
      return "PUT";
    case UpdateType.PATCH:
      return "PATCH";
    case UpdateType.DELETE:
      return "DELETE";
    default:
      return String(op);
  }
}

const TABLE_CONFIG: Record<string, TableConfig> = {
  users: {
    columns: ["created_at"],
    canPut: async ({ username, id }) => username === id,
    canPatch: async () => false,
    canDelete: async () => false,
  },
  agents: {
    columns: [
      "name",
      "model_config",
      "system_instructions",
      "description",
      "created_at",
    ],
    canPut: async ({ username }) => Boolean(username),
    canPatch: async () => false,
    canDelete: async () => false,
  },
  channels: {
    columns: ["name", "created_by", "created_at"],
    canPut: async ({ username, opData }) => opData.created_by === username,
    canPatch: async ({ username, id, opData }) => {
      if ("created_by" in opData || "created_at" in opData) return false;
      return isChannelCreator(id, username);
    },
    canDelete: async ({ username, id }) => isChannelCreator(id, username),
  },
  channel_members: {
    columns: ["channel_id", "member_type", "member_id", "joined_at"],
    canPut: async ({ username, opData }) => {
      return isChannelMember(opData.channel_id, username);
    },
    canPatch: async () => false,
    canDelete: async ({ username, id }) => {
      const existing = await getChannelMemberRow(id);
      if (!existing) return false;

      if (existing.member_type === "user" && existing.member_id === username) {
        return true;
      }

      return isChannelMember(existing.channel_id, username);
    },
  },
  messages: {
    columns: [
      "channel_id",
      "author_type",
      "author_id",
      "content",
      "mentioned_agent",
      "created_at",
    ],
    canPut: async ({ username, opData }) => {
      if (opData.author_type !== "user") return false;
      if (opData.author_id !== username) return false;
      return isChannelMember(opData.channel_id, username);
    },
    canPatch: async ({ username, id, opData }) => {
      if (
        "channel_id" in opData ||
        "author_type" in opData ||
        "author_id" in opData ||
        "created_at" in opData
      ) {
        return false;
      }

      const existing = await getMessageOwner(id);
      return (
        existing?.author_type === "user" && existing.author_id === username
      );
    },
    canDelete: async ({ username, id }) => {
      const existing = await getMessageOwner(id);
      return (
        existing?.author_type === "user" && existing.author_id === username
      );
    },
  },
};

async function assertAuthorizedOperation(
  username: string,
  operation: UploadOperation,
): Promise<{ opData: Record<string, any>; columns: string[] }> {
  const config = TABLE_CONFIG[operation.table];
  if (!config) {
    throw new Error(`Table not writable: ${operation.table}`);
  }

  const opData = normalizeOpData(operation.id, operation.opData);
  const columns = validateColumns(operation.table, config.columns, opData);
  const authorizedOperation: AuthorizedOperation = {
    username,
    id: operation.id,
    opType: operation.op,
    opData,
  };

  let allowed = false;
  switch (operation.op) {
    case UpdateType.PUT:
      allowed = await config.canPut(authorizedOperation);
      break;
    case UpdateType.PATCH:
      if (columns.length === 0) {
        throw new Error("PATCH requires at least one writable column");
      }
      allowed = await config.canPatch(authorizedOperation);
      break;
    case UpdateType.DELETE:
      allowed = await config.canDelete(authorizedOperation);
      break;
    default:
      throw new Error(`Unsupported operation: ${operation.op}`);
  }

  if (!allowed) {
    throw new Error(
      `Unauthorized ${getOperationLabel(operation.op)} on ${operation.table}`,
    );
  }

  return { opData, columns };
}

// Token generation for PowerSync authentication
export async function getPowerSyncToken() {
  const username = getRequestUsername();

  const kid = process.env.POWERSYNC_JWT_KID;
  const secretB64url = process.env.POWERSYNC_JWT_SECRET;
  const instanceUrl = process.env.POWERSYNC_SERVICE_URL;
  if (!kid || !secretB64url || !instanceUrl)
    throw new Error(
      "POWERSYNC_JWT_KID, POWERSYNC_JWT_SECRET, or POWERSYNC_SERVICE_URL not set",
    );

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

// Upload data from PowerSync client to Neon
export async function uploadData(transactions: UploadOperation[]) {
  console.log("[uploadData] transactions", transactions.length);

  try {
    const username = getRequestUsername();

    // Process synchronously - DO NOT queue for later per PowerSync docs
    for (const op of transactions) {
      const { op: opType, table: tableName, id } = op;
      const { opData, columns } = await assertAuthorizedOperation(username, op);

      switch (opType) {
        case UpdateType.PUT:
          if (columns.length === 0) {
            throw new Error("PUT requires at least one writable column");
          }

          const putCols = columns;
          const putVals = putCols.map((k) => opData[k]);
          await query(
            `INSERT INTO ${tableName} (id, ${putCols.join(", ")})
             VALUES ($1, ${putCols.map((_, i) => `$${i + 2}`).join(", ")})
             ON CONFLICT (id) DO UPDATE SET
             ${putCols.map((k) => `${k} = EXCLUDED.${k}`).join(", ")}`,
            [id, ...putVals],
          );
          break;

        case UpdateType.PATCH:
          const patchCols = columns;
          const patchVals = patchCols.map((k) => opData[k]);
          await query(
            `UPDATE ${tableName}
             SET ${patchCols.map((k, i) => `${k} = $${i + 1}`).join(", ")}
             WHERE id = $${patchCols.length + 1}`,
            [...patchVals, id],
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
