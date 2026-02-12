import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { ChannelInvite } from "./index";

const { mockExecute, mockWriteTransaction } = vi.hoisted(() => {
  const execute = vi.fn();
  return {
    mockExecute: execute,
    mockWriteTransaction: vi.fn(async (cb: any) => cb({ execute })),
  };
});

let queryData = {
  allAgents: [{ id: "agent-1", name: "Assistant", description: "Helpful" }],
  channelAgents: [] as Array<{ member_id: string }>,
  allUsers: [{ id: "alice" }, { id: "bob" }],
  channelMembers: [{ member_id: "alice" }],
};

vi.mock("~/lib/getUsername", () => ({
  getUsername: vi.fn(() => "alice"),
}));

vi.mock("~/lib/powersync-solid", () => ({
  usePowerSync: vi.fn(() => ({
    writeTransaction: mockWriteTransaction,
  })),
  useQuery: vi.fn((query: () => string) => () => {
    const sql = query();
    if (sql.includes("FROM agents")) {
      return { data: queryData.allAgents, isLoading: false, error: undefined };
    }
    if (sql.includes("member_type = 'agent'")) {
      return {
        data: queryData.channelAgents,
        isLoading: false,
        error: undefined,
      };
    }
    if (sql.includes("SELECT id FROM users")) {
      return { data: queryData.allUsers, isLoading: false, error: undefined };
    }
    if (sql.includes("SELECT member_id FROM channel_members WHERE channel_id = ?")) {
      return {
        data: queryData.channelMembers,
        isLoading: false,
        error: undefined,
      };
    }
    return { data: [], isLoading: false, error: undefined };
  }),
}));

describe("ChannelInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(mockWriteTransaction).toHaveBeenCalled();
      expect(screen.getByText("bob added to channel!")).toBeInTheDocument();
    });

    const executeArgs = mockExecute.mock.calls[0][1];
    expect(executeArgs[1]).toBe("test-channel-123");
    expect(executeArgs[2]).toBe("bob");
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
      expect(mockWriteTransaction).toHaveBeenCalled();
      expect(screen.getByText("Assistant added to channel!")).toBeInTheDocument();
    });

    const executeArgs = mockExecute.mock.calls[0][1];
    expect(executeArgs[2]).toBe("agent-1");
  });
});
