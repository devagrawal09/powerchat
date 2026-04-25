import { isUtf8 } from "node:buffer";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { channelMembers, channels } from "~/db/schema/server";
import { MAX_WORKSPACE_TEXT_FILE_BYTES } from "~/lib/workspace-file-viewability";
import { getChannelWorkspacePath } from "./channel-workspace";
import { db } from "./db";
import { normalizeWorkspaceRelativePath } from "./workspace-node-indexer";

export { MAX_WORKSPACE_TEXT_FILE_BYTES };

export type WorkspaceTextFileSnapshot = {
  path: string;
  name: string;
  content: string;
  modifiedAt: string;
  sizeBytes: number;
};

type ReadWorkspaceTextFileInput = {
  channelId: string;
  relativePath: string;
  username: string;
};

type ReadWorkspaceTextFileOptions = {
  getWorkspacePath?: (channelId: string) => string;
  hasChannelAccess?: (channelId: string, username: string) => Promise<boolean>;
};

async function hasChannelWorkspaceAccess(channelId: string, username: string) {
  const [membershipRows, creatorRows] = await Promise.all([
    db
      .select({ id: channelMembers.id })
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.memberType, "user"),
          eq(channelMembers.memberId, username),
        ),
      )
      .limit(1),
    db
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.createdBy, username)))
      .limit(1),
  ]);

  return membershipRows.length > 0 || creatorRows.length > 0;
}

function isPathInsideWorkspaceRoot(
  workspaceRootPath: string,
  candidatePath: string,
) {
  const relativePath = path.relative(workspaceRootPath, candidatePath);
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function isTextFileBuffer(fileBuffer: Buffer) {
  if (fileBuffer.length === 0) {
    return true;
  }

  const sample = fileBuffer.subarray(0, Math.min(fileBuffer.length, 8_192));
  if (sample.includes(0)) {
    return false;
  }

  if (!isUtf8(sample)) {
    return false;
  }

  let suspiciousControlCount = 0;
  for (const byte of sample) {
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      suspiciousControlCount += 1;
    }
  }

  return suspiciousControlCount / sample.length < 0.05;
}

export async function readWorkspaceTextFileForUser(
  input: ReadWorkspaceTextFileInput,
  options: ReadWorkspaceTextFileOptions = {},
): Promise<WorkspaceTextFileSnapshot> {
  const normalizedRelativePath = normalizeWorkspaceRelativePath(
    input.relativePath,
  );
  const hasChannelAccess =
    options.hasChannelAccess ?? hasChannelWorkspaceAccess;

  if (!(await hasChannelAccess(input.channelId, input.username))) {
    throw new Error("Unauthorized workspace file access");
  }

  const getWorkspacePath = options.getWorkspacePath ?? getChannelWorkspacePath;
  const workspaceRootPath = path.resolve(getWorkspacePath(input.channelId));
  const absoluteFilePath = path.resolve(
    workspaceRootPath,
    normalizedRelativePath,
  );

  if (!isPathInsideWorkspaceRoot(workspaceRootPath, absoluteFilePath)) {
    throw new Error(`Invalid workspace relative path: ${input.relativePath}`);
  }

  const fileStats = await stat(absoluteFilePath);
  if (fileStats.isDirectory()) {
    throw new Error("Cannot open directories");
  }

  if (fileStats.size > MAX_WORKSPACE_TEXT_FILE_BYTES) {
    throw new Error("File too large");
  }

  const fileBuffer = await readFile(absoluteFilePath);
  if (!isTextFileBuffer(fileBuffer)) {
    throw new Error("Unsupported file type");
  }

  return {
    path: normalizedRelativePath,
    name: path.posix.basename(normalizedRelativePath),
    content: fileBuffer.toString("utf8"),
    modifiedAt: fileStats.mtime.toISOString(),
    sizeBytes: fileStats.size,
  };
}
