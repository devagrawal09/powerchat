import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ChannelDocumentsList } from "./index";

// Mock dependencies
vi.mock("~/lib/powersync-solid/hooks/useQuery", () => ({
  useQuery: vi.fn(() => () => ({
    data: [
      {
        id: "doc-1",
        title: "Project Plan",
        description: "Main project plan document",
      },
      {
        id: "doc-2",
        title: "Meeting Notes",
        description: "Notes from team meeting",
      },
    ],
    isLoading: false,
  })),
}));

describe("ChannelDocumentsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders documents section header", () => {
    const onDocumentClick = vi.fn();
    render(() => (
      <ChannelDocumentsList
        channelId="test-channel"
        onDocumentClick={onDocumentClick}
      />
    ));
    expect(screen.getByText("Documents")).toBeInTheDocument();
  });

  it("renders list of documents", () => {
    const onDocumentClick = vi.fn();
    render(() => (
      <ChannelDocumentsList
        channelId="test-channel"
        onDocumentClick={onDocumentClick}
      />
    ));
    expect(screen.getByText("Project Plan")).toBeInTheDocument();
    expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
  });

  it("calls onDocumentClick when document is clicked", () => {
    const onDocumentClick = vi.fn();
    render(() => (
      <ChannelDocumentsList
        channelId="test-channel"
        onDocumentClick={onDocumentClick}
      />
    ));
    const projectPlan = screen.getByText("Project Plan");
    fireEvent.click(projectPlan);
    expect(onDocumentClick).toHaveBeenCalledWith("doc-1");
  });

  it("handles empty document list", async () => {
    const { useQuery } = await import("~/lib/powersync-solid/hooks/useQuery");
    vi.mocked(useQuery).mockReturnValueOnce(() => ({
      data: [],
      isLoading: false,
    }));

    const onDocumentClick = vi.fn();
    render(() => (
      <ChannelDocumentsList
        channelId="test-channel"
        onDocumentClick={onDocumentClick}
      />
    ));
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.queryByText("Project Plan")).not.toBeInTheDocument();
  });

  it("hides content while loading", async () => {
    const { useQuery } = await import("~/lib/powersync-solid/hooks/useQuery");
    vi.mocked(useQuery).mockReturnValueOnce(() => ({
      data: [],
      isLoading: true,
    }));

    const onDocumentClick = vi.fn();
    render(() => (
      <ChannelDocumentsList
        channelId="test-channel"
        onDocumentClick={onDocumentClick}
      />
    ));
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.queryByText("Project Plan")).not.toBeInTheDocument();
  });
});
