import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { ChannelInvite } from "./index";

vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: vi.fn(),
  and: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("~/lib/getUsername", () => ({
  getUsername: vi.fn(() => "testuser"),
}));

vi.mock("~/lib/tanstack-db", () => ({
  agentsCollection: {},
  channelMembersCollection: {
    insert: vi.fn(() => ({ isPersisted: { promise: Promise.resolve() } })),
  },
  ensureTanStackDbReady: vi.fn().mockResolvedValue(undefined),
  usersCollection: {},
}));

describe("ChannelInvite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useLiveQuery } = await import("@tanstack/solid-db");
    let callCount = 0;
    vi.mocked(useLiveQuery).mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Object.assign(
          () => [{ id: "agent-1", name: "Assistant", description: "helper" }],
          { isLoading: false, isReady: true },
        );
      }
      if (callCount === 2) {
        return Object.assign(() => [], { isLoading: false, isReady: true });
      }
      if (callCount === 3) {
        return Object.assign(
          () => [{ id: "testuser" }, { id: "newuser" }],
          { isLoading: false, isReady: true },
        );
      }
      return Object.assign(
        () => [{ member_id: "testuser" }],
        { isLoading: false, isReady: true },
      );
    });
  });

  it("renders invite form", () => {
    render(() => <ChannelInvite channelId="test-channel" />);

    expect(screen.getByText("Invite")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
    expect(screen.getByText("Add User")).toBeInTheDocument();
  });

  it("validates empty username", async () => {
    render(() => <ChannelInvite channelId="test-channel" />);

    const form = screen.getByText("Add User").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Please enter a username")).toBeInTheDocument();
    });
  });

  it("invites user via channelMembersCollection insert", async () => {
    const { channelMembersCollection } = await import("~/lib/tanstack-db");
    render(() => <ChannelInvite channelId="test-channel-123" />);

    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Add User");

    fireEvent.input(input, { target: { value: "newuser" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(channelMembersCollection.insert).toHaveBeenCalled();
    });
  });

  it("displays success message and clears input", async () => {
    render(() => <ChannelInvite channelId="test-channel" />);

    const input = screen.getByPlaceholderText(
      "Enter username"
    ) as HTMLInputElement;
    const button = screen.getByText("Add User");

    fireEvent.input(input, { target: { value: "newuser" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("newuser added to channel!")).toBeInTheDocument();
    });

    expect(input.value).toBe("");
  });

  it("displays error when user does not exist", async () => {
    const { useLiveQuery } = await import("@tanstack/solid-db");
    let callCount = 0;
    vi.mocked(useLiveQuery).mockImplementation(() => {
      callCount += 1;
      if (callCount === 3) {
        return Object.assign(() => [{ id: "testuser" }], {
          isLoading: false,
          isReady: true,
        });
      }
      if (callCount === 4) {
        return Object.assign(() => [{ member_id: "testuser" }], {
          isLoading: false,
          isReady: true,
        });
      }
      return Object.assign(() => [], { isLoading: false, isReady: true });
    });

    render(() => <ChannelInvite channelId="test-channel" />);

    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Add User");

    fireEvent.input(input, { target: { value: "nonexistent" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("User not found")).toBeInTheDocument();
    });
  });

  it("disables button when input is empty", () => {
    render(() => <ChannelInvite channelId="test-channel" />);

    const button = screen.getByText("Add User") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("enables button when input has value", () => {
    render(() => <ChannelInvite channelId="test-channel" />);

    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Add User") as HTMLButtonElement;

    fireEvent.input(input, { target: { value: "newuser" } });
    expect(button.disabled).toBe(false);
  });

  it("trims whitespace from username", async () => {
    const { channelMembersCollection } = await import("~/lib/tanstack-db");
    render(() => <ChannelInvite channelId="test-channel" />);

    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Add User");

    fireEvent.input(input, { target: { value: "  newuser  " } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(channelMembersCollection.insert).toHaveBeenCalled();
    });
    const payload = vi.mocked(channelMembersCollection.insert).mock.calls[0][0];
    expect(payload.member_id).toBe("newuser");
  });
});
