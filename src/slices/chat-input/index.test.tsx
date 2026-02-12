import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ChatInput } from "./index";

// Mock dependencies
const { mockWriteTransaction } = vi.hoisted(() => ({
  mockWriteTransaction: vi.fn(),
}));

vi.mock("~/lib/powersync-solid", () => ({
  usePowerSync: vi.fn(() => ({
    writeTransaction: mockWriteTransaction,
  })),
}));


vi.mock("~/lib/getUsername", () => ({
  getUsername: vi.fn(() => "testuser"),
}));

vi.mock("~/lib/powersync-solid/hooks/useQuery", () => ({
  useQuery: vi.fn(() => () => ({
    data: [
      {
        member_type: "agent",
        member_id: "00000000-0000-0000-0000-000000000001",
        name: "Assistant",
      },
    ],
    isLoading: false,
  })),
}));

describe("ChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders input with correct placeholder", () => {
    render(() => <ChatInput channelId="test-channel" channelName="general" />);
    const input = screen.getByPlaceholderText("Message #general...");
    expect(input).toBeInTheDocument();
  });

  it("renders send button", () => {
    render(() => <ChatInput channelId="test-channel" />);
    const button = screen.getByText("Send");
    expect(button).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(() => <ChatInput channelId="test-channel" />);
    const button = screen.getByText("Send") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("enables send button when input has content", () => {
    render(() => <ChatInput channelId="test-channel" />);
    const input = screen.getByPlaceholderText(/Message #/);
    const button = screen.getByText("Send") as HTMLButtonElement;

    fireEvent.input(input, { target: { value: "Hello world" } });
    expect(button.disabled).toBe(false);
  });

  it("clears input after successful send", async () => {
    mockWriteTransaction.mockResolvedValue(undefined);

    render(() => <ChatInput channelId="test-channel" />);
    const input = screen.getByPlaceholderText(/Message #/) as HTMLInputElement;
    const button = screen.getByText("Send");

    fireEvent.input(input, { target: { value: "Test message" } });
    fireEvent.click(button);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(input.value).toBe("");
  });

});
