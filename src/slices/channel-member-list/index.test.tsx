import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { ChannelMemberList } from "./index";

vi.mock("~/lib/powersync-solid/hooks/useQuery", () => ({
  useQuery: vi.fn(() => () => {
    return {
      data: [{ member_type: "user", member_id: "user1", name: "alice" }],
      isLoading: false,
    };
  }),
}));

describe("ChannelMemberList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders users", () => {
    render(() => <ChannelMemberList channelId="test-channel" />);
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("displays user members", () => {
    render(() => <ChannelMemberList channelId="test-channel" />);
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("does not render agent section", () => {
    render(() => <ChannelMemberList channelId="test-channel" />);
    expect(screen.queryByText("Agents")).not.toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
  });
});
