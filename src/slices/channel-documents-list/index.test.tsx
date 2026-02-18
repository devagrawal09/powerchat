import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ChannelDocumentsList } from "./index";

// Mock dependencies
vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: vi.fn(() =>
    Object.assign(
      () => [
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
      { isLoading: false, isReady: true },
    ),
  ),
  eq: vi.fn(),
}));

vi.mock("~/lib/tanstack-db", () => ({
  documentsCollection: {},
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
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [], { isLoading: false, isReady: true }),
    );

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
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [], { isLoading: true, isReady: false }),
    );

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
