import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ChatInput } from "./index";

// Mock dependencies
vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: vi.fn(() =>
    Object.assign(() => [], { isLoading: false, isReady: true }),
  ),
  and: vi.fn(),
  coalesce: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("~/slices/mention-autocomplete", () => ({
  MentionAutocomplete: () => null,
}));

vi.mock("~/lib/tanstack-db", () => ({
  agentsCollection: {},
  channelMembersCollection: {},
  documentsCollection: {},
  ensureTanStackDbReady: vi.fn().mockResolvedValue(undefined),
  messagesCollection: {
    insert: vi.fn(() => ({ isPersisted: { promise: Promise.resolve() } })),
  },
  usersCollection: {},
}));

vi.mock("~/lib/getUsername", () => ({
  getUsername: vi.fn(() => "testuser"),
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
    const { messagesCollection } = await import("~/lib/tanstack-db");

    render(() => <ChatInput channelId="test-channel" />);
    const input = screen.getByPlaceholderText(/Message #/) as HTMLInputElement;
    const button = screen.getByText("Send");

    fireEvent.input(input, { target: { value: "Test message" } });
    fireEvent.click(button);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(messagesCollection.insert).toHaveBeenCalled();
    expect(input.value).toBe("");
  });

});
