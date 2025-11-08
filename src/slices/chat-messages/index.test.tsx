import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { ChatMessages } from "./index";

// Mock dependencies
const mockMessages = [
  {
    id: "msg-1",
    channel_id: "channel-1",
    author_type: "user" as const,
    author_id: "user-1",
    content: "Hello world",
    created_at: "2024-01-01T10:00:00.000Z",
    author_name: "user-1",
  },
  {
    id: "msg-2",
    channel_id: "channel-1",
    author_type: "agent" as const,
    author_id: "00000000-0000-0000-0000-000000000001",
    content: "Hello! How can I help?",
    created_at: "2024-01-01T10:01:00.000Z",
    author_name: "assistant",
  },
  {
    id: "msg-3",
    channel_id: "channel-1",
    author_type: "system" as const,
    author_id: "system",
    content: "Channel created",
    created_at: "2024-01-01T09:59:00.000Z",
    author_name: "System",
  },
];

vi.mock("~/lib/useWatchedQuery", () => ({
  useWatchedQuery: vi.fn(() => ({
    data: mockMessages,
    loading: false,
  })),
}));

vi.mock("~/components/Markdown", () => ({
  RenderMarkdown: (props: { children: string }) => (
    <span>{props.children}</span>
  ),
}));

describe("ChatMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all messages", () => {
    render(() => <ChatMessages channelId="channel-1" />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("Hello! How can I help?")).toBeInTheDocument();
    expect(screen.getByText("Channel created")).toBeInTheDocument();
  });

  it("displays author names", () => {
    render(() => <ChatMessages channelId="channel-1" />);

    expect(screen.getByText("user-1")).toBeInTheDocument();
    expect(screen.getByText("assistant")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("displays author avatars with first letter", () => {
    render(() => <ChatMessages channelId="channel-1" />);

    const avatars = screen.getAllByText(/^[UAS]$/);
    expect(avatars).toHaveLength(3);
    expect(avatars[0]).toHaveTextContent("U"); // user-1
    expect(avatars[1]).toHaveTextContent("A"); // assistant
    expect(avatars[2]).toHaveTextContent("S"); // System
  });

  it("displays timestamps in localized format", () => {
    render(() => <ChatMessages channelId="channel-1" />);

    // Timestamps should be formatted by toLocaleTimeString()
    const timestamps = document.querySelectorAll(".text-xs.text-gray-500");
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it("shows loading state", async () => {
    const { useWatchedQuery } = await import("~/lib/useWatchedQuery");
    vi.mocked(useWatchedQuery).mockReturnValueOnce({
      data: [],
      loading: true,
      error: undefined,
    });

    const { container } = render(() => <ChatMessages channelId="channel-1" />);

    // When loading, the For loop won't render any messages
    // Check that the container doesn't have message elements
    const messageElements = container.querySelectorAll(".flex.gap-3");
    expect(messageElements.length).toBe(0);
  });

  it("renders empty state when no messages", async () => {
    const { useWatchedQuery } = await import("~/lib/useWatchedQuery");
    vi.mocked(useWatchedQuery).mockReturnValueOnce({
      data: [],
      loading: false,
      error: undefined,
    });

    const { container } = render(() => <ChatMessages channelId="channel-1" />);

    const messageElements = container.querySelectorAll(".flex.gap-3");
    expect(messageElements.length).toBe(0);
  });

  it("handles missing author_name gracefully", async () => {
    const { useWatchedQuery } = await import("~/lib/useWatchedQuery");
    vi.mocked(useWatchedQuery).mockReturnValueOnce({
      data: [
        {
          id: "msg-4",
          channel_id: "channel-1",
          author_type: "user" as const,
          author_id: "user-unknown",
          content: "Test message",
          created_at: "2024-01-01T10:00:00.000Z",
          author_name: null,
        },
      ],
      loading: false,
      error: undefined,
    });

    render(() => <ChatMessages channelId="channel-1" />);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument(); // Avatar fallback
  });

  it("queries messages with correct channel ID", async () => {
    const { useWatchedQuery } = await import("~/lib/useWatchedQuery");

    render(() => <ChatMessages channelId="test-channel-123" />);

    expect(useWatchedQuery).toHaveBeenCalled();
    const call = vi.mocked(useWatchedQuery).mock.calls[0];

    // Check that the query parameters function returns the correct channel ID
    const paramsFunction = call[1];
    expect(paramsFunction()).toEqual(["test-channel-123"]);
  });

  it("orders messages by created_at and id", async () => {
    const { useWatchedQuery } = await import("~/lib/useWatchedQuery");

    render(() => <ChatMessages channelId="channel-1" />);

    // Verify the SQL query includes ORDER BY clause
    const call = vi.mocked(useWatchedQuery).mock.calls[0];
    const sqlFunction = call[0];
    const sql = sqlFunction();

    expect(sql).toContain("ORDER BY m.created_at ASC, m.id ASC");
  });

  it("includes author name resolution in query", async () => {
    const { useWatchedQuery } = await import("~/lib/useWatchedQuery");

    render(() => <ChatMessages channelId="channel-1" />);

    // Verify the SQL query includes CASE statement for author name resolution
    const call = vi.mocked(useWatchedQuery).mock.calls[0];
    const sqlFunction = call[0];
    const sql = sqlFunction();

    expect(sql).toContain("CASE");
    expect(sql).toContain("WHEN m.author_type = 'user'");
    expect(sql).toContain("WHEN m.author_type = 'agent'");
    expect(sql).toContain("WHEN m.author_type = 'system'");
  });

  it("renders markdown content", () => {
    render(() => <ChatMessages channelId="channel-1" />);

    // Verify RenderMarkdown component is used
    // The mock replaces it with a simple span, but the content should still render
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});
