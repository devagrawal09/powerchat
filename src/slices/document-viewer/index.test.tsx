import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { DocumentViewer } from "./index";

const mockReadWorkspaceFile = vi.fn();

// Mock dependencies
vi.mock("~/server/workspace-files", () => ({
  readWorkspaceFile: (...args: any[]) => mockReadWorkspaceFile(...args),
}));

vi.mock("~/components/Markdown", () => ({
  RenderMarkdown: (props: { children: string }) => <div>{props.children}</div>,
}));

describe("DocumentViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders file name in header when loaded", async () => {
    mockReadWorkspaceFile.mockResolvedValue({
      path: "docs/readme.md",
      name: "readme.md",
      content: "# Hello\n\nWorld",
      size: 20,
      modifiedAt: "2024-01-01T00:00:00.000Z",
    });

    const onClose = vi.fn();
    render(() => (
      <DocumentViewer
        channelId="test-channel"
        filePath="docs/readme.md"
        onClose={onClose}
      />
    ));

    // Wait for async resource to resolve
    await vi.waitFor(() => {
      expect(screen.getByText("readme.md")).toBeInTheDocument();
    });
  });

  it("renders close button", () => {
    mockReadWorkspaceFile.mockResolvedValue({
      path: "test.md",
      name: "test.md",
      content: "content",
      size: 7,
      modifiedAt: "2024-01-01T00:00:00.000Z",
    });

    const onClose = vi.fn();
    render(() => (
      <DocumentViewer
        channelId="test-channel"
        filePath="test.md"
        onClose={onClose}
      />
    ));
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    mockReadWorkspaceFile.mockResolvedValue({
      path: "test.md",
      name: "test.md",
      content: "content",
      size: 7,
      modifiedAt: "2024-01-01T00:00:00.000Z",
    });

    const onClose = vi.fn();
    render(() => (
      <DocumentViewer
        channelId="test-channel"
        filePath="test.md"
        onClose={onClose}
      />
    ));
    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders file content when loaded", async () => {
    mockReadWorkspaceFile.mockResolvedValue({
      path: "docs/readme.md",
      name: "readme.md",
      content: "# Content\n\nTest content here",
      size: 30,
      modifiedAt: "2024-01-01T00:00:00.000Z",
    });

    const onClose = vi.fn();
    render(() => (
      <DocumentViewer
        channelId="test-channel"
        filePath="docs/readme.md"
        onClose={onClose}
      />
    ));

    await vi.waitFor(() => {
      expect(
        screen.getByText(/# Content\s+Test content here/),
      ).toBeInTheDocument();
    });
  });

  it("renders file path when loaded", async () => {
    mockReadWorkspaceFile.mockResolvedValue({
      path: "docs/readme.md",
      name: "readme.md",
      content: "Some content",
      size: 12,
      modifiedAt: "2024-01-01T00:00:00.000Z",
    });

    const onClose = vi.fn();
    render(() => (
      <DocumentViewer
        channelId="test-channel"
        filePath="docs/readme.md"
        onClose={onClose}
      />
    ));

    await vi.waitFor(() => {
      expect(screen.getByText("docs/readme.md")).toBeInTheDocument();
    });
  });

  it("shows default title when file is not yet loaded", () => {
    // Never resolves, simulating a pending load
    mockReadWorkspaceFile.mockReturnValue(new Promise(() => {}));

    const onClose = vi.fn();
    render(() => (
      <DocumentViewer
        channelId="test-channel"
        filePath="test.md"
        onClose={onClose}
      />
    ));
    expect(screen.getByText("Document")).toBeInTheDocument();
  });

  it("calls readWorkspaceFile with correct channelId and filePath", () => {
    mockReadWorkspaceFile.mockResolvedValue({
      path: "notes/todo.txt",
      name: "todo.txt",
      content: "Buy milk",
      size: 8,
      modifiedAt: "2024-01-01T00:00:00.000Z",
    });

    const onClose = vi.fn();
    render(() => (
      <DocumentViewer
        channelId="channel-123"
        filePath="notes/todo.txt"
        onClose={onClose}
      />
    ));

    expect(mockReadWorkspaceFile).toHaveBeenCalledWith(
      "channel-123",
      "notes/todo.txt",
    );
  });

  it("shows loading state", () => {
    mockReadWorkspaceFile.mockReturnValue(new Promise(() => {}));

    const onClose = vi.fn();
    render(() => (
      <DocumentViewer
        channelId="test-channel"
        filePath="test.md"
        onClose={onClose}
      />
    ));

    expect(screen.getByText("Loading file...")).toBeInTheDocument();
  });
});
