import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { ChannelHeader } from "./index";

vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: vi.fn(() =>
    Object.assign(
      () => [
        {
          id: "test-channel",
          name: "general",
          created_by: "user1",
          created_at: "2024-01-01",
        },
      ],
      { isLoading: false, isReady: true },
    ),
  ),
  eq: vi.fn(),
}));

vi.mock("~/lib/tanstack-db", () => ({
  channelsCollection: {},
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
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [], { isLoading: true, isReady: false }),
    );

    render(() => <ChannelHeader channelId="test-channel" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
