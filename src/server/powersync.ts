"use server";

import { UpdateType } from "@powersync/common";
import { and, eq } from "drizzle-orm";
import {
  agents,
  channelMembers,
  channels,
  messages,
  users,
} from "~/db/schema/server";
import { db } from "./db";
import { onMessage } from "./onMessage";
import { getRequestUsername } from "./request-auth";

type UploadOperation = {
  op: UpdateType;
  table: string;
  id: string;
  opData: Record<string, any>;
};

type UploadedUserMessage = {
  id: string;
  channel_id: string;
  author_id: string;
  content: string | null;
  mentioned_agent: string | null;
};

const WRITABLE_COLUMNS = {
  users: ["created_at"],
  agents: [
    "name",
    "model_config",
    "system_instructions",
    "description",
    "created_at",
  ],
  channels: ["name", "created_by", "created_at"],
  channel_members: ["channel_id", "member_type", "member_id", "joined_at"],
  messages: [
    "channel_id",
    "author_type",
    "author_id",
    "content",
    "mentioned_agent",
    "created_at",
  ],
} as const satisfies Record<string, readonly string[]>;

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

function validateColumns(table: string, opData: Record<string, any>) {
  const allowedColumns =
    WRITABLE_COLUMNS[table as keyof typeof WRITABLE_COLUMNS];
  if (!allowedColumns) {
    throw new Error(`Table not writable: ${table}`);
  }

  const allowed = new Set<string>(allowedColumns);
  const columns = Object.keys(opData);
  const invalidColumns = columns.filter((column) => !allowed.has(column));

  if (invalidColumns.length > 0) {
    throw new Error(
      `Invalid columns for ${table}: ${invalidColumns.join(", ")}`,
    );
  }

  return columns;
}

function getOperationLabel(op: UpdateType) {
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

async function isChannelMember(
  channelId: string | undefined,
  username: string,
) {
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
) {
  if (!channelId) return false;

  const result = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.createdBy, username)))
    .limit(1);

  return result.length > 0;
}

async function getMessageOwner(messageId: string) {
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

async function getChannelMemberRow(memberRowId: string) {
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

async function assertAuthorizedOperation(
  username: string,
  operation: UploadOperation,
): Promise<{ opData: Record<string, any>; columns: string[] }> {
  const opData = normalizeOpData(operation.id, operation.opData);
  const columns = validateColumns(operation.table, opData);

  let allowed = false;

  switch (operation.table) {
    case "users":
      allowed = operation.op === UpdateType.PUT && username === operation.id;
      break;
    case "agents":
      allowed = operation.op === UpdateType.PUT && Boolean(username);
      break;
    case "channels":
      if (operation.op === UpdateType.PUT) {
        allowed = opData.created_by === username;
      } else if (operation.op === UpdateType.PATCH) {
        if ("created_by" in opData || "created_at" in opData) {
          allowed = false;
        } else {
          allowed = await isChannelCreator(operation.id, username);
        }
      } else if (operation.op === UpdateType.DELETE) {
        allowed = await isChannelCreator(operation.id, username);
      }
      break;
    case "channel_members":
      if (operation.op === UpdateType.PUT) {
        allowed =
          (await isChannelMember(opData.channel_id, username)) ||
          (await isChannelCreator(opData.channel_id, username));
      } else if (operation.op === UpdateType.DELETE) {
        const existing = await getChannelMemberRow(operation.id);
        allowed = Boolean(
          existing &&
          ((existing.member_type === "user" &&
            existing.member_id === username) ||
            (await isChannelMember(existing.channel_id, username))),
        );
      }
      break;
    case "messages":
      if (operation.op === UpdateType.PUT) {
        allowed =
          opData.author_type === "user" &&
          opData.author_id === username &&
          (await isChannelMember(opData.channel_id, username));
      } else if (
        operation.op === UpdateType.PATCH ||
        operation.op === UpdateType.DELETE
      ) {
        if (
          operation.op === UpdateType.PATCH &&
          ("channel_id" in opData ||
            "author_type" in opData ||
            "author_id" in opData ||
            "created_at" in opData)
        ) {
          allowed = false;
        } else {
          const existing = await getMessageOwner(operation.id);
          allowed = true;
        }
      }
      break;
    default:
      throw new Error(`Table not writable: ${operation.table}`);
  }

  if (operation.op === UpdateType.PATCH && columns.length === 0) {
    throw new Error("PATCH requires at least one writable column");
  }

  if (operation.op === UpdateType.PUT && columns.length === 0) {
    throw new Error("PUT requires at least one writable column");
  }

  if (!allowed) {
    throw new Error(
      `Unauthorized ${getOperationLabel(operation.op)} on ${operation.table}`,
    );
  }

  return { opData, columns };
}

function getMessageMentionedAgent(opData: Record<string, any>) {
  if (typeof opData.mentioned_agent === "string") {
    return JSON.parse(opData.mentioned_agent);
  }

  return opData.mentioned_agent ?? null;
}

function getUploadedUserMessage(
  opData: Record<string, any>,
  id: string,
): UploadedUserMessage {
  return {
    id,
    channel_id: opData.channel_id,
    author_id: opData.author_id,
    content: opData.content ?? null,
    mentioned_agent:
      typeof opData.mentioned_agent === "string"
        ? opData.mentioned_agent
        : opData.mentioned_agent
          ? JSON.stringify(opData.mentioned_agent)
          : null,
  };
}

// Upload data from PowerSync client to Neon
export async function uploadData(transactions: UploadOperation[]) {
  console.log("[uploadData] transactions", transactions.length);

  try {
    const username = getRequestUsername();
    const uploadedUserMessages: UploadedUserMessage[] = [];

    for (const operation of transactions) {
      const { id, table, op } = operation;
      const { opData } = await assertAuthorizedOperation(username, operation);

      switch (table) {
        case "users":
          if (op === UpdateType.PUT) {
            await db
              .insert(users)
              .values({ id, createdAt: opData.created_at })
              .onConflictDoUpdate({
                target: users.id,
                set: { createdAt: opData.created_at },
              });
          } else if (op === UpdateType.DELETE) {
            await db.delete(users).where(eq(users.id, id));
          }
          break;

        case "agents":
          if (op === UpdateType.PUT) {
            await db
              .insert(agents)
              .values({
                id,
                name: opData.name,
                modelConfig: opData.model_config,
                systemInstructions: opData.system_instructions,
                description: opData.description,
                createdAt: opData.created_at,
              })
              .onConflictDoUpdate({
                target: agents.id,
                set: {
                  name: opData.name,
                  modelConfig: opData.model_config,
                  systemInstructions: opData.system_instructions,
                  description: opData.description,
                  createdAt: opData.created_at,
                },
              });
          } else if (op === UpdateType.DELETE) {
            await db.delete(agents).where(eq(agents.id, id));
          }
          break;

        case "channels":
          if (op === UpdateType.PUT) {
            await db
              .insert(channels)
              .values({
                id,
                name: opData.name,
                createdBy: opData.created_by,
                createdAt: opData.created_at,
              })
              .onConflictDoUpdate({
                target: channels.id,
                set: {
                  name: opData.name,
                  createdBy: opData.created_by,
                  createdAt: opData.created_at,
                },
              });
          } else if (op === UpdateType.PATCH) {
            await db
              .update(channels)
              .set({ name: opData.name })
              .where(eq(channels.id, id));
          } else if (op === UpdateType.DELETE) {
            await db.delete(channels).where(eq(channels.id, id));
          }
          break;

        case "channel_members":
          if (op === UpdateType.PUT) {
            await db
              .insert(channelMembers)
              .values({
                id,
                channelId: opData.channel_id,
                memberType: opData.member_type,
                memberId: opData.member_id,
                joinedAt: opData.joined_at,
              })
              .onConflictDoUpdate({
                target: channelMembers.id,
                set: {
                  channelId: opData.channel_id,
                  memberType: opData.member_type,
                  memberId: opData.member_id,
                  joinedAt: opData.joined_at,
                },
              });
          } else if (op === UpdateType.DELETE) {
            await db.delete(channelMembers).where(eq(channelMembers.id, id));
          }
          break;

        case "messages":
          if (op === UpdateType.PUT) {
            const values = {
              id,
              channelId: opData.channel_id,
              authorType: opData.author_type,
              authorId: opData.author_id,
              content: opData.content,
              mentionedAgent: getMessageMentionedAgent(opData),
              createdAt: opData.created_at,
            };

            if (opData.author_type === "user") {
              const insertedRows = await db
                .insert(messages)
                .values(values)
                .onConflictDoNothing({ target: messages.id })
                .returning({ id: messages.id });

              if (insertedRows.length === 0) {
                await db
                  .update(messages)
                  .set(values)
                  .where(eq(messages.id, id));
              } else {
                uploadedUserMessages.push(getUploadedUserMessage(opData, id));
              }
            } else {
              await db
                .insert(messages)
                .values(values)
                .onConflictDoUpdate({ target: messages.id, set: values });
            }
          } else if (op === UpdateType.PATCH) {
            await db
              .update(messages)
              .set({
                content: opData.content,
                mentionedAgent: getMessageMentionedAgent(opData),
              })
              .where(eq(messages.id, id));
          } else if (op === UpdateType.DELETE) {
            await db.delete(messages).where(eq(messages.id, id));
          }
          break;

        default:
          throw new Error(`Table not writable: ${table}`);
      }
    }

    for (const message of uploadedUserMessages) {
      onMessage(message)
        .then(() => {
          console.log(`Agent execution complete for message:`, { message });
        })
        .catch((error) => {
          console.error("[uploadData] failed to trigger agent", {
            messageId: message.id,
            error,
          });
        });
    }

    return { success: true };
  } catch (error: any) {
    console.error("[uploadData] error:", error);
    return { success: false, error: error.message };
  }
}
