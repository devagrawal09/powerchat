import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createWorkspaceNodeRow,
  getWorkspaceTargetFromAbsolutePath,
  isWorkspaceFileTarget,
  normalizeWorkspaceRelativePath,
  scanWorkspaceChannelDirectory,
} from "./workspace-node-indexer";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("workspace node indexer", () => {
  it("normalizes safe workspace-relative paths", () => {
    expect(normalizeWorkspaceRelativePath("notes\\todo.md")).toBe(
      "notes/todo.md",
    );
    expect(normalizeWorkspaceRelativePath("./docs/../docs/readme.md")).toBe(
      "docs/readme.md",
    );
    expect(() => normalizeWorkspaceRelativePath("../secrets.txt")).toThrow(
      /Invalid workspace relative path/,
    );
    expect(() => normalizeWorkspaceRelativePath("/")).toThrow(
      /Invalid workspace relative path/,
    );
  });

  it("maps absolute paths back to channel + relative path safely", () => {
    const workspaceRoot = path.join("/tmp", "workspaces");

    expect(
      getWorkspaceTargetFromAbsolutePath(
        path.join(workspaceRoot, "channel%2Fone", "notes", "todo.md"),
        workspaceRoot,
      ),
    ).toEqual({
      channelId: "channel/one",
      relativePath: "notes/todo.md",
    });

    expect(
      getWorkspaceTargetFromAbsolutePath(
        path.join(workspaceRoot, "channel%2Fone"),
        workspaceRoot,
      ),
    ).toEqual({
      channelId: "channel/one",
      relativePath: null,
    });

    expect(
      getWorkspaceTargetFromAbsolutePath("/tmp/elsewhere/todo.md", workspaceRoot),
    ).toBeNull();
  });

  it("identifies file targets for watcher upserts", () => {
    expect(
      isWorkspaceFileTarget({ channelId: "channel/one", relativePath: "notes/todo.md" }),
    ).toBe(true);
    expect(
      isWorkspaceFileTarget({ channelId: "channel/one", relativePath: null }),
    ).toBe(false);
  });

  it("creates workspace node rows from file metadata", () => {
    const row = createWorkspaceNodeRow(
      {
        channelId: "channel/one",
        relativePath: "notes/todo.md",
      },
      {
        isDirectory: () => false,
        size: 42,
        mtime: new Date("2024-01-02T03:04:05.000Z"),
      },
    );

    expect(row).toEqual({
      id: "channel%2Fone:notes/todo.md",
      channelId: "channel/one",
      path: "notes/todo.md",
      parentPath: "notes",
      name: "todo.md",
      kind: "file",
      sizeBytes: 42,
      modifiedAt: "2024-01-02T03:04:05.000Z",
    });
  });

  it("scans workspace directories into metadata rows", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "powerchat-workspace-"));
    tempDirs.push(tempDir);

    const channelRoot = path.join(tempDir, "channel%2Fone");
    await mkdir(path.join(channelRoot, "notes"), { recursive: true });
    await writeFile(path.join(channelRoot, "README.md"), "hello");
    await writeFile(path.join(channelRoot, "notes", "todo.md"), "todo");

    const rows = await scanWorkspaceChannelDirectory("channel/one", channelRoot);

    expect(rows.map((row) => `${row.kind}:${row.path}`)).toEqual([
      "file:README.md",
      "dir:notes",
      "file:notes/todo.md",
    ]);
    expect(rows.find((row) => row.path === "notes")).toMatchObject({
      parentPath: null,
      sizeBytes: null,
    });
  });
});
