import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelWorkspaceTree } from "./index";

const { mockUseChannelWorkspaceNodes } = vi.hoisted(() => ({
  mockUseChannelWorkspaceNodes: vi.fn(),
}));

vi.mock("./useChannelWorkspaceNodes", () => ({
  useChannelWorkspaceNodes: mockUseChannelWorkspaceNodes,
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

    expect(screen.getByText("Failed to load workspace.")).toBeInTheDocument();
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

  it("opens supported text files and leaves binary files inert", async () => {
    const onFileSelect = vi.fn();

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
          id: "channel-1:image.png",
          channelId: "channel-1",
          path: "image.png",
          parentPath: null,
          name: "image.png",
          kind: "file",
          sizeBytes: 20,
          modifiedAt: "2024-01-02T03:04:05.000Z",
        },
      ],
      isLoading: false,
    }));

    render(() => (
      <ChannelWorkspaceTree
        channelId="channel-1"
        onFileSelect={onFileSelect}
      />
    ));

    fireEvent.click(screen.getByRole("button", { name: "Toggle docs" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "readme.md" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "readme.md" }));

    expect(onFileSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "docs/readme.md",
        name: "readme.md",
      }),
    );
    expect(
      screen.queryByRole("button", { name: "image.png" }),
    ).not.toBeInTheDocument();
  });
});
