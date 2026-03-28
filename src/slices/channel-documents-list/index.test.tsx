import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ChannelDocumentsList } from "./index";

// Mock the server function
const mockListWorkspaceFiles = vi.fn();

vi.mock("~/server/workspace-files", () => ({
  listWorkspaceFiles: (...args: unknown[]) => mockListWorkspaceFiles(...args),
}));

describe("ChannelDocumentsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders workspace files section header", () => {
    mockListWorkspaceFiles.mockResolvedValue([]);

    const onFileClick = vi.fn();
    render(() => (
      <ChannelDocumentsList
        channelId="test-channel"
        onFileClick={onFileClick}
      />
    ));
    expect(screen.getByText("Workspace Files")).toBeInTheDocument();
  });

  it("renders list of workspace files", async () => {
    mockListWorkspaceFiles.mockResolvedValue([
      {
        name: "README.md",
        path: "README.md",
        type: "file",
        size: 1024,
        modifiedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        name: "src",
        path: "src",
        type: "directory",
        size: 0,
        modifiedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);

    const onFileClick = vi.fn();
    render(() => (
      <ChannelDocumentsList
        channelId="test-channel"
        onFileClick={onFileClick}
      />
    ));

    // Wait for async data to load
    await vi.waitFor(() => {
      expect(screen.getByText("README.md")).toBeInTheDocument();
    });
    expect(screen.getByText("src")).toBeInTheDocument();
  });

  it("calls onFileClick with file path when file is clicked", async () => {
    mockListWorkspaceFiles.mockResolvedValue([
      {
        name: "notes.txt",
        path: "docs/notes.txt",
        type: "file",
        size: 512,
        modifiedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);

    const onFileClick = vi.fn();
    render(() => (
      <ChannelDocumentsList
        channelId="test-channel"
        onFileClick={onFileClick}
      />
    ));

    await vi.waitFor(() => {
      expect(screen.getByText("notes.txt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("notes.txt"));
    expect(onFileClick).toHaveBeenCalledWith("docs/notes.txt");
  });

  it("handles empty workspace (no files)", async () => {
    mockListWorkspaceFiles.mockResolvedValue([]);

    const onFileClick = vi.fn();
    render(() => (
      <ChannelDocumentsList
        channelId="test-channel"
        onFileClick={onFileClick}
      />
    ));

    // Header should still show
    expect(screen.getByText("Workspace Files")).toBeInTheDocument();

    // Wait for loading to finish
    await vi.waitFor(() => {
      expect(mockListWorkspaceFiles).toHaveBeenCalledWith("test-channel");
    });

    // No file entries should be present
    expect(screen.queryByText("README.md")).not.toBeInTheDocument();
  });

  it("calls listWorkspaceFiles with the correct channelId", async () => {
    mockListWorkspaceFiles.mockResolvedValue([]);

    const onFileClick = vi.fn();
    render(() => (
      <ChannelDocumentsList
        channelId="my-channel-123"
        onFileClick={onFileClick}
      />
    ));

    await vi.waitFor(() => {
      expect(mockListWorkspaceFiles).toHaveBeenCalledWith("my-channel-123");
    });
  });
});
