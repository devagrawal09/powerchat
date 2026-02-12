import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { ChannelHeader } from "./index";

vi.mock("~/lib/powersync-solid/hooks/useQuery", () => ({
  useQuery: vi.fn(() => () => ({
    data: [
      {
        id: "test-channel",
        name: "general",
        created_by: "user1",
        created_at: "2024-01-01",
      },
    ],
    isLoading: false,
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
    const { useQuery } = await import("~/lib/powersync-solid/hooks/useQuery");
    vi.mocked(useQuery).mockReturnValueOnce(() => ({
      data: [],
      isLoading: true,
    }));

    render(() => <ChannelHeader channelId="test-channel" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("#");
  });
});
