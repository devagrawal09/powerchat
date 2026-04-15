import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getChannelWorkspace,
  getChannelWorkspacePath,
  resetChannelWorkspaceCache,
} from "./channel-workspace";

describe("channel workspace", () => {
  afterEach(() => {
    resetChannelWorkspaceCache();
  });

  it("builds unique workspace path per channel", () => {
    expect(getChannelWorkspacePath("channel-1")).toBe(
      path.resolve(
        process.cwd(),
        ".mastra-workspaces",
        "channels",
        "channel-1",
      ),
    );
    expect(getChannelWorkspacePath("channel/2")).toBe(
      path.resolve(
        process.cwd(),
        ".mastra-workspaces",
        "channels",
        "channel%2F2",
      ),
    );
  });

  it("reuses workspace instance for same channel", async () => {
    const first = await getChannelWorkspace("channel-1");
    const second = await getChannelWorkspace("channel-1");
    const other = await getChannelWorkspace("channel-2");

    expect(first).toBe(second);
    expect(first).not.toBe(other);
  });
});
