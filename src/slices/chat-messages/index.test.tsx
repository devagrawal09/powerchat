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
    author_name: "Assistant",
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

vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: vi.fn(),
  and: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("~/lib/tanstack-db", () => ({
  agentsCollection: {},
  channelMembersCollection: {},
  ensureTanStackDbReady: vi.fn().mockResolvedValue(undefined),
  messagesCollection: {
    delete: vi.fn(() => ({ isPersisted: { promise: Promise.resolve() } })),
  },
  usersCollection: {},
}));

vi.mock("~/components/Markdown", () => ({
  RenderMarkdown: (props: { children: string }) => (
    <span>{props.children}</span>
  ),
}));

describe("ChatMessages", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useLiveQuery } = await import("@tanstack/solid-db");
    let callCount = 0;
    vi.mocked(useLiveQuery).mockImplementation(() => {
      callCount += 1;
      if (callCount % 2 === 1) {
        return Object.assign(() => mockMessages, { isLoading: false, isReady: true });
      }
      return Object.assign(
        () => [
          {
            member_type: "user",
            member_id: "user-1",
            user_name: "user-1",
            agent_name: null,
          },
          {
            member_type: "agent",
            member_id: "00000000-0000-0000-0000-000000000001",
            user_name: null,
            agent_name: "Assistant",
          },
        ],
        { isLoading: false, isReady: true },
      );
    });
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
    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("displays author avatars with first letter", () => {
    render(() => <ChatMessages channelId="channel-1" />);

    const avatars = screen.getAllByText(/^[UAS]$/);
    expect(avatars).toHaveLength(3);
    expect(avatars[0]).toHaveTextContent("U"); // user-1
    expect(avatars[1]).toHaveTextContent("A"); // Assistant
    expect(avatars[2]).toHaveTextContent("S"); // System
  });

  it("displays timestamps in localized format", () => {
    render(() => <ChatMessages channelId="channel-1" />);

    // Timestamps should be formatted by toLocaleTimeString()
    const timestamps = document.querySelectorAll(".text-xs.text-gray-500");
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it("shows loading state", async () => {
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [], { isLoading: true, isReady: false }),
    );

    render(() => <ChatMessages channelId="channel-1" />);
    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
  });

  it("renders empty state when no messages", async () => {
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [], { isLoading: false, isReady: true }),
    );
    render(() => <ChatMessages channelId="channel-1" />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("handles missing author_name gracefully", async () => {
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(
        () => [
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
        { isLoading: false, isReady: true },
      ),
    );

    render(() => <ChatMessages channelId="channel-1" />);

    expect(screen.getByText("user-unknown")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("renders markdown content", () => {
    render(() => <ChatMessages channelId="channel-1" />);

    // Verify RenderMarkdown component is used
    // The mock replaces it with a simple span, but the content should still render
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});
