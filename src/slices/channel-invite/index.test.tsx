import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { ChannelInvite } from "./index";

const { mockInsertValues, mockInsert, mockClientDb } = vi.hoisted(() => {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  return {
    mockInsertValues: insertValues,
    mockInsert: vi.fn(() => ({ values: insertValues })),
    mockClientDb: {
      insert: vi.fn(() => ({ values: insertValues })),
    },
  };
});

let queryData = {
  allAgents: [{ id: "agent-1", name: "Assistant", description: "Helpful" }],
  channelAgents: [] as Array<{ member_id: string }>,
  allUsers: [{ id: "alice" }, { id: "bob" }],
  channelMembers: [{ member_id: "alice" }],
};
let queryCall = 0;

vi.mock("~/lib/getUsername", () => ({
  getUsername: vi.fn(() => "alice"),
}));

vi.mock("~/db/client", () => ({
  agents: {},
  channelMembers: {},
  clientDb: mockClientDb,
  liveQuery: (query: any) => query,
  users: {},
}));

vi.mock("~/lib/powersync-solid", () => ({
  useQuery: vi.fn(() => {
    const result = [
      queryData.allAgents,
      queryData.channelAgents,
      queryData.allUsers,
      queryData.channelMembers,
    ][queryCall++] ?? [];
    return () => ({ data: result, isLoading: false, error: undefined });
  }),
}));

describe("ChannelInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientDb.insert = mockInsert;
    queryCall = 0;
    queryData = {
      allAgents: [{ id: "agent-1", name: "Assistant", description: "Helpful" }],
      channelAgents: [],
      allUsers: [{ id: "alice" }, { id: "bob" }],
      channelMembers: [{ member_id: "alice" }],
    };
  });

  it("renders invite form with tabs", () => {
    render(() => <ChannelInvite channelId="test-channel" />);
    expect(screen.getByText("Invite")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Add User")).toBeDisabled();
  });

  it("shows error when current user is not a channel member", async () => {
    queryData.channelMembers = [{ member_id: "bob" }];

    render(() => <ChannelInvite channelId="test-channel" />);
    fireEvent.input(screen.getByPlaceholderText("Enter username"), {
      target: { value: "bob" },
    });
    fireEvent.click(screen.getByText("Add User"));

    await waitFor(() => {
      expect(
        screen.getByText("You must be a member of this channel to invite users"),
      ).toBeInTheDocument();
    });
  });

  it("invites a user through writeTransaction", async () => {
    render(() => <ChannelInvite channelId="test-channel-123" />);

    fireEvent.input(screen.getByPlaceholderText("Enter username"), {
      target: { value: "bob" },
    });
    fireEvent.click(screen.getByText("Add User"));

    await waitFor(() => {
      expect(mockClientDb.insert).toHaveBeenCalled();
      expect(screen.getByText("bob added to channel!")).toBeInTheDocument();
    });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "test-channel-123",
        memberId: "bob",
        memberType: "user",
      }),
    );
    expect(screen.getByPlaceholderText("Enter username")).toHaveValue("");
  });

  it("shows agent picker with available agents", () => {
    render(() => <ChannelInvite channelId="test-channel" />);
    fireEvent.click(screen.getByText("Agent"));

    expect(screen.getByText("Add Agent")).toBeDisabled();
    expect(screen.getByRole("option", { name: "Assistant" })).toBeInTheDocument();
  });

  it("invites selected agent through writeTransaction", async () => {
    render(() => <ChannelInvite channelId="test-channel" />);
    fireEvent.click(screen.getByText("Agent"));

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "agent-1" },
    });
    fireEvent.click(screen.getByText("Add Agent"));

    await waitFor(() => {
      expect(mockClientDb.insert).toHaveBeenCalled();
      expect(screen.getByText("Assistant added to channel!")).toBeInTheDocument();
    });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "agent-1",
        memberType: "agent",
      }),
    );
  });
});
