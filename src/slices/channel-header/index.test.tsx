import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { ChannelHeader } from "./index";

vi.mock("~/lib/useWatchedQuery", () => ({
  useWatchedQuery: vi.fn(() => ({
    data: [
      {
        id: "test-channel",
        name: "general",
        created_by: "user1",
        created_at: "2024-01-01",
      },
    ],
    loading: false,
  })),
}));

describe("ChannelHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders channel name", () => {
    render(() => <ChannelHeader channelId="test-channel" />);
    expect(screen.getByText("# general")).toBeInTheDocument();
  });

  it("shows loading state", async () => {
    const { useWatchedQuery } = await import("~/lib/useWatchedQuery");
    vi.mocked(useWatchedQuery).mockReturnValueOnce({
      data: [],
      loading: true,
    });

    render(() => <ChannelHeader channelId="test-channel" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
