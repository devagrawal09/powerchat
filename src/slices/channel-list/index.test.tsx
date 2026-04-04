import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { ChannelList } from "./index";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

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

vi.mock("~/lib/powersync-solid", () => ({
  useQuery: mockUseQuery,
}));

mockUseQuery.mockReturnValue(() => ({
    data: mockChannels,
    isLoading: false,
}));

vi.mock("~/slices/delete-channel", () => ({
  DeleteChannel: (props: { channelId: string }) => (
    <button data-testid={`delete-${props.channelId}`}>×</button>
  ),
}));

describe("ChannelList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(() => ({
      data: mockChannels,
      isLoading: false,
    }));
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
    mockUseQuery.mockReturnValueOnce(() => ({
      data: [],
      isLoading: true,
      error: undefined,
    }));

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
