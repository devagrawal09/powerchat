import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { ChannelList } from "./index";

// Mock dependencies
vi.mock("@solidjs/router", () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

const mockChannels = [
  {
    id: "channel-1",
    name: "general",
    created_by: "user1",
    created_at: "2024-01-01",
  },
  {
    id: "channel-2",
    name: "random",
    created_by: "user1",
    created_at: "2024-01-02",
  },
];

vi.mock("~/lib/useWatchedQuery", () => ({
  useWatchedQuery: vi.fn(() => ({
    data: mockChannels,
    loading: false,
  })),
}));

vi.mock("~/slices/delete-channel", () => ({
  DeleteChannel: (props: { channelId: string }) => (
    <button data-testid={`delete-${props.channelId}`}>×</button>
  ),
}));

describe("ChannelList", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });
  it("renders channel list header", () => {
    render(() => <ChannelList />);
    expect(screen.getByText("Channels")).toBeInTheDocument();
  });

  it("renders all channels from query", () => {
    render(() => <ChannelList />);
    expect(screen.getByText(/general/)).toBeInTheDocument();
    expect(screen.getByText(/random/)).toBeInTheDocument();
  });

  it("renders delete button for each channel", () => {
    render(() => <ChannelList />);
    expect(screen.getByTestId("delete-channel-1")).toBeInTheDocument();
    expect(screen.getByTestId("delete-channel-2")).toBeInTheDocument();
  });

  it("shows loading state while query is loading", async () => {
    // Import and mock for this specific test
    const { useWatchedQuery } = await import("~/lib/useWatchedQuery");
    vi.mocked(useWatchedQuery).mockReturnValueOnce({
      data: [],
      loading: true,
      error: undefined,
    });

    render(() => <ChannelList />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders channels in correct format", () => {
    render(() => <ChannelList />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/channel/channel-1");
    expect(links[1]).toHaveAttribute("href", "/channel/channel-2");
  });
});
