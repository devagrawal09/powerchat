import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { ChannelMemberList } from "./index";

vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: vi.fn(() =>
    Object.assign(
      () => [{ member_id: "user1", user_id: "alice" }],
      { isLoading: false, isReady: true },
    ),
  ),
  and: vi.fn(),
  coalesce: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("~/lib/tanstack-db", () => ({
  channelMembersCollection: {},
  usersCollection: {},
}));

describe("ChannelMemberList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders members section", () => {
    render(() => <ChannelMemberList channelId="test-channel" />);
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("displays user members", () => {
    render(() => <ChannelMemberList channelId="test-channel" />);
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("hides members while loading", async () => {
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [], { isLoading: true, isReady: false }),
    );
    render(() => <ChannelMemberList channelId="test-channel" />);
    expect(screen.queryByText("alice")).not.toBeInTheDocument();
  });
});
