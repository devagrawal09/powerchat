import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { ChannelMemberList } from "./index";

vi.mock("~/lib/useWatchedQuery", () => ({
  useWatchedQuery: vi.fn((query) => {
    if (query().includes("member_type = 'user'")) {
      return {
        data: [{ member_type: "user", member_id: "user1", name: "alice" }],
        loading: false,
      };
    }
    return {
      data: [
        {
          member_type: "agent",
          member_id: "00000000-0000-0000-0000-000000000001",
          name: "assistant",
        },
      ],
      loading: false,
    };
  }),
}));

describe("ChannelMemberList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders members section", () => {
    render(() => <ChannelMemberList channelId="test-channel" />);
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("displays user members", () => {
    render(() => <ChannelMemberList channelId="test-channel" />);
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("displays agent members", () => {
    render(() => <ChannelMemberList channelId="test-channel" />);
    expect(screen.getByText("assistant")).toBeInTheDocument();
  });
});
