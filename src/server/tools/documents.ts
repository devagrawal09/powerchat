"use server";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { query } from "../db";

export const listDocuments = createTool({
  id: "listDocuments",
  description:
    "Lists all documents in a channel. Returns title and description for each document so you can choose which one to read.",
  inputSchema: z.object({
    channel_id: z.string().describe("The channel ID to list documents from"),
  }),
  outputSchema: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
    })
  ),
  execute: async ({ context }) => {
    const { channel_id } = context;

    // Verify channel exists
    const channelCheck = await query(`SELECT id FROM channels WHERE id = $1`, [
      channel_id,
    ]);
    if (channelCheck.rows.length === 0) {
      throw new Error(`Channel ${channel_id} not found`);
    }

    const result = await query(
      `SELECT id, title, description 
       FROM documents 
       WHERE channel_id = $1 
       ORDER BY created_at DESC`,
      [channel_id]
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
    }));
  },
});

export const createDocument = createTool({
  id: "createDocument",
  description:
    "Creates a new document in a channel with markdown content. Use this for long-form responses, detailed explanations, or knowledge transfer to other agents.",
  inputSchema: z.object({
    channel_id: z.string().describe("The channel ID to create the document in"),
    title: z.string().describe("A short, descriptive title for the document"),
    description: z
      .string()
      .describe(
        "A short description of what the document contains, helping other agents find it"
      ),
    content: z.string().describe("The markdown content of the document"),
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
  }),
  execute: async ({ context }) => {
    const { channel_id, title, description, content } = context;

    // Verify channel exists
    const channelCheck = await query(`SELECT id FROM channels WHERE id = $1`, [
      channel_id,
    ]);
    if (channelCheck.rows.length === 0) {
      throw new Error(`Channel ${channel_id} not found`);
    }

    const documentId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await query(
      `INSERT INTO documents (id, channel_id, title, description, content, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [documentId, channel_id, title, description, content, createdAt]
    );

    return {
      id: documentId,
      title,
      description,
    };
  },
});

export const readDocument = createTool({
  id: "readDocument",
  description:
    "Reads the full content of a document by its ID. Use this after listing documents to read the detailed markdown content.",
  inputSchema: z.object({
    document_id: z.string().describe("The ID of the document to read"),
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    content: z.string(),
  }),
  execute: async ({ context }) => {
    const { document_id } = context;

    const result = await query(
      `SELECT id, title, description, content 
       FROM documents 
       WHERE id = $1`,
      [document_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Document ${document_id} not found`);
    }

    const doc = result.rows[0];
    return {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      content: doc.content,
    };
  },
});
