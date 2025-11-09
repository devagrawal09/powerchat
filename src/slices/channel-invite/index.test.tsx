import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { ChannelInvite } from "./index";

// Mock dependencies
vi.mock("./action", () => ({
  inviteByUsername: vi.fn(),
  inviteAgent: vi.fn(),
}));

describe("ChannelInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders invite form", () => {
    render(() => <ChannelInvite channelId="test-channel" />);

    expect(screen.getByText("Invite by Username")).toBeInTheDocument();
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

  it("calls inviteByUsername with correct data", async () => {
    const { inviteByUsername } = await import("./action");
    vi.mocked(inviteByUsername).mockResolvedValue({ success: true });

    render(() => <ChannelInvite channelId="test-channel-123" />);

    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Add User");

    fireEvent.input(input, { target: { value: "newuser" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(inviteByUsername).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(inviteByUsername).mock.calls[0][0];
    expect(callArgs.get("channelId")).toBe("test-channel-123");
    expect(callArgs.get("username")).toBe("newuser");
  });

  it("displays success message and clears input after successful invite", async () => {
    const { inviteByUsername } = await import("./action");
    vi.mocked(inviteByUsername).mockResolvedValue({ success: true });

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

  it("displays error message when invite fails", async () => {
    const { inviteByUsername } = await import("./action");
    vi.mocked(inviteByUsername).mockResolvedValue({
      error: "User not found",
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

  it("shows 'Adding...' while submitting", async () => {
    const { inviteByUsername } = await import("./action");
    vi.mocked(inviteByUsername).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ success: true }), 1000)
        )
    );

    render(() => <ChannelInvite channelId="test-channel" />);

    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Add User");

    fireEvent.input(input, { target: { value: "newuser" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Adding...")).toBeInTheDocument();
    });
  });

  it("disables input and button while submitting", async () => {
    const { inviteByUsername } = await import("./action");
    vi.mocked(inviteByUsername).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ success: true }), 1000)
        )
    );

    render(() => <ChannelInvite channelId="test-channel" />);

    const input = screen.getByPlaceholderText(
      "Enter username"
    ) as HTMLInputElement;
    const button = screen.getByText("Add User") as HTMLButtonElement;

    fireEvent.input(input, { target: { value: "newuser" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(input.disabled).toBe(true);
      expect(button.disabled).toBe(true);
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
    const { inviteByUsername } = await import("./action");
    vi.mocked(inviteByUsername).mockResolvedValue({ success: true });

    render(() => <ChannelInvite channelId="test-channel" />);

    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Add User");

    fireEvent.input(input, { target: { value: "  newuser  " } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(inviteByUsername).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(inviteByUsername).mock.calls[0][0];
    expect(callArgs.get("username")).toBe("newuser");
  });

  it("handles exception from server", async () => {
    const { inviteByUsername } = await import("./action");
    vi.mocked(inviteByUsername).mockRejectedValue(new Error("Network error"));

    render(() => <ChannelInvite channelId="test-channel" />);

    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Add User");

    fireEvent.input(input, { target: { value: "newuser" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});
