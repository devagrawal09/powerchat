import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceFileViewer } from "./index";

const { mockReadChannelWorkspaceTextFile } = vi.hoisted(() => ({
  mockReadChannelWorkspaceTextFile: vi.fn(),
}));

vi.mock("~/server/workspace-file-actions", () => ({
  readChannelWorkspaceTextFile: mockReadChannelWorkspaceTextFile,
}));

describe("WorkspaceFileViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state while file content is in flight", () => {
    mockReadChannelWorkspaceTextFile.mockReturnValue(new Promise(() => {}));

    render(() => (
      <WorkspaceFileViewer
        channelId="channel-1"
        filePath="docs/readme.md"
        onClose={vi.fn()}
      />
    ));

    expect(screen.getByText("Opening file…")).toBeInTheDocument();
  });

  it("renders raw text content with metadata", async () => {
    mockReadChannelWorkspaceTextFile.mockResolvedValue({
      path: "docs/readme.md",
      name: "readme.md",
      content: "# not rendered\nconst x = 1;",
      modifiedAt: "2024-01-02T03:04:05.000Z",
      sizeBytes: 28,
    });

    const { container } = render(() => (
      <WorkspaceFileViewer
        channelId="channel-1"
        filePath="docs/readme.md"
        onClose={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(container.textContent).toContain("28 bytes");
    });

    expect(screen.getByText("docs/readme.md")).toBeInTheDocument();
    expect(container.querySelector("pre")?.textContent).toBe(
      "# not rendered\nconst x = 1;",
    );
    expect(container.textContent).toContain("28 bytes");
  });

  it("renders unsupported state when server rejects file", async () => {
    mockReadChannelWorkspaceTextFile.mockRejectedValue(
      new Error("Unsupported file type"),
    );

    render(() => (
      <WorkspaceFileViewer
        channelId="channel-1"
        filePath="image.png"
        onClose={vi.fn()}
      />
    ));

    await waitFor(() => {
      expect(screen.getByText("Unable to open file.")).toBeInTheDocument();
    });

    expect(screen.getByText("Unsupported file type")).toBeInTheDocument();
  });
});
