import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_WORKSPACE_TEXT_FILE_BYTES,
  readWorkspaceTextFileForUser,
} from "./workspace-file-reader";

const tempDirectories: string[] = [];

async function createWorkspaceRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "powerchat-workspace-file-"));
  tempDirectories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("readWorkspaceTextFileForUser", () => {
  it("reads normalized text file content for authorized user", async () => {
    const workspaceRoot = await createWorkspaceRoot();
    const channelRoot = path.join(workspaceRoot, "channel-1");
    await mkdir(path.join(channelRoot, "docs"), { recursive: true });
    await writeFile(path.join(channelRoot, "docs", "readme.md"), "hello\nworld\n");

    const result = await readWorkspaceTextFileForUser(
      {
        channelId: "channel-1",
        relativePath: "./docs/readme.md",
        username: "alice",
      },
      {
        getWorkspacePath: (channelId) => path.join(workspaceRoot, channelId),
        hasChannelAccess: vi.fn().mockResolvedValue(true),
      },
    );

    expect(result).toMatchObject({
      path: "docs/readme.md",
      name: "readme.md",
      content: "hello\nworld\n",
      sizeBytes: 12,
    });
  });

  it("rejects path traversal before reading", async () => {
    await expect(
      readWorkspaceTextFileForUser(
        {
          channelId: "channel-1",
          relativePath: "../secret.txt",
          username: "alice",
        },
        {
          hasChannelAccess: vi.fn().mockResolvedValue(true),
        },
      ),
    ).rejects.toThrow("Invalid workspace relative path");
  });

  it("rejects users without channel access", async () => {
    await expect(
      readWorkspaceTextFileForUser(
        {
          channelId: "channel-1",
          relativePath: "docs/readme.md",
          username: "alice",
        },
        {
          hasChannelAccess: vi.fn().mockResolvedValue(false),
        },
      ),
    ).rejects.toThrow("Unauthorized workspace file access");
  });

  it("rejects binary files", async () => {
    const workspaceRoot = await createWorkspaceRoot();
    const channelRoot = path.join(workspaceRoot, "channel-1");
    await mkdir(channelRoot, { recursive: true });
    await writeFile(
      path.join(channelRoot, "image.png"),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]),
    );

    await expect(
      readWorkspaceTextFileForUser(
        {
          channelId: "channel-1",
          relativePath: "image.png",
          username: "alice",
        },
        {
          getWorkspacePath: (channelId) => path.join(workspaceRoot, channelId),
          hasChannelAccess: vi.fn().mockResolvedValue(true),
        },
      ),
    ).rejects.toThrow("Unsupported file type");
  });

  it("rejects files over size cap", async () => {
    const workspaceRoot = await createWorkspaceRoot();
    const channelRoot = path.join(workspaceRoot, "channel-1");
    await mkdir(channelRoot, { recursive: true });
    await writeFile(
      path.join(channelRoot, "big.txt"),
      "x".repeat(MAX_WORKSPACE_TEXT_FILE_BYTES + 1),
    );

    await expect(
      readWorkspaceTextFileForUser(
        {
          channelId: "channel-1",
          relativePath: "big.txt",
          username: "alice",
        },
        {
          getWorkspacePath: (channelId) => path.join(workspaceRoot, channelId),
          hasChannelAccess: vi.fn().mockResolvedValue(true),
        },
      ),
    ).rejects.toThrow("File too large");
  });
});
