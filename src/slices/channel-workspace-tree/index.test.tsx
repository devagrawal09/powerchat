import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelWorkspaceTree } from "./index";

const {
  mockUseChannelWorkspaceNodes,
  mockRefreshWorkspaceNodes,
} = vi.hoisted(() => ({
  mockUseChannelWorkspaceNodes: vi.fn(),
  mockRefreshWorkspaceNodes: vi.fn(),
}));

vi.mock("./useChannelWorkspaceNodes", () => ({
  useChannelWorkspaceNodes: mockUseChannelWorkspaceNodes,
}));

vi.mock("~/server/workspace-node-actions", () => ({
  refreshChannelWorkspaceIndex: mockRefreshWorkspaceNodes,
}));

describe("ChannelWorkspaceTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    mockUseChannelWorkspaceNodes.mockReturnValue(() => ({
      data: [],
      isLoading: true,
    }));

    render(() => <ChannelWorkspaceTree channelId="channel-1" />);

    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Loading workspace…")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    mockUseChannelWorkspaceNodes.mockReturnValue(() => ({
      data: [],
      isLoading: false,
    }));

    render(() => <ChannelWorkspaceTree channelId="channel-1" />);

    expect(screen.getByText("Workspace empty")).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseChannelWorkspaceNodes.mockReturnValue(() => ({
      data: [],
      isLoading: false,
      error: new Error("boom"),
    }));

    render(() => <ChannelWorkspaceTree channelId="channel-1" />);

    expect(screen.getByText("Failed to load workspace."))
      .toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders live tree and toggles folders", async () => {
    mockUseChannelWorkspaceNodes.mockReturnValue(() => ({
      data: [
        {
          id: "channel-1:docs",
          channelId: "channel-1",
          path: "docs",
          parentPath: null,
          name: "docs",
          kind: "dir",
          sizeBytes: null,
          modifiedAt: "2024-01-02T03:04:05.000Z",
        },
        {
          id: "channel-1:docs/readme.md",
          channelId: "channel-1",
          path: "docs/readme.md",
          parentPath: "docs",
          name: "readme.md",
          kind: "file",
          sizeBytes: 10,
          modifiedAt: "2024-01-02T03:04:05.000Z",
        },
        {
          id: "channel-1:package.json",
          channelId: "channel-1",
          path: "package.json",
          parentPath: null,
          name: "package.json",
          kind: "file",
          sizeBytes: 20,
          modifiedAt: "2024-01-02T03:04:05.000Z",
        },
      ],
      isLoading: false,
    }));

    render(() => <ChannelWorkspaceTree channelId="channel-1" />);

    expect(screen.getByText("package.json")).toBeInTheDocument();
    expect(screen.queryByText("readme.md")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle docs" }));

    await waitFor(() => {
      expect(screen.getByText("readme.md")).toBeInTheDocument();
    });
  });

  it("refreshes workspace metadata on demand", async () => {
    mockUseChannelWorkspaceNodes.mockReturnValue(() => ({
      data: [],
      isLoading: false,
    }));
    mockRefreshWorkspaceNodes.mockResolvedValue(undefined);

    render(() => <ChannelWorkspaceTree channelId="channel-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh workspace" }));

    await waitFor(() => {
      expect(mockRefreshWorkspaceNodes).toHaveBeenCalledWith("channel-1");
    });
  });
});
