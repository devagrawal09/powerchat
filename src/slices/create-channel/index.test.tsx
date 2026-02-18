import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { CreateChannel } from "./index";

// Mock dependencies
vi.mock("@solidjs/router", () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock("~/lib/tanstack-db", () => ({
  channelMembersCollection: {
    insert: vi.fn(() => ({ isPersisted: { promise: Promise.resolve() } })),
  },
  channelsCollection: {
    insert: vi.fn(() => ({ isPersisted: { promise: Promise.resolve() } })),
  },
  ensureTanStackDbReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/getUsername", () => ({
  getUsername: vi.fn(() => "testuser"),
}));

describe("CreateChannel", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { channelsCollection, channelMembersCollection } = await import(
      "~/lib/tanstack-db"
    );
    vi.mocked(channelsCollection.insert).mockReturnValue(
      ({ isPersisted: { promise: Promise.resolve() } }) as any,
    );
    vi.mocked(channelMembersCollection.insert).mockReturnValue(
      ({ isPersisted: { promise: Promise.resolve() } }) as any,
    );
  });

  it("renders form with input and button", () => {
    render(() => <CreateChannel />);
    expect(screen.getByPlaceholderText("New channel name")).toBeInTheDocument();
    expect(screen.getByText("Create Channel")).toBeInTheDocument();
  });

  it("shows 'Creating...' while submitting", async () => {
    const { channelsCollection } = await import("~/lib/tanstack-db");
    vi.mocked(channelsCollection.insert).mockImplementation(
      () =>
        ({
          isPersisted: {
            promise: new Promise((resolve) => {
              setTimeout(resolve, 1000);
            }),
          },
        }) as any,
    );

    render(() => <CreateChannel />);
    const input = screen.getByPlaceholderText("New channel name");
    const button = screen.getByText("Create Channel");

    fireEvent.input(input, { target: { value: "new-channel" } });
    fireEvent.click(button);

    expect(screen.getByText("Creating...")).toBeInTheDocument();
  });

  it("calls collection inserts with correct data", async () => {
    const { channelsCollection, channelMembersCollection } = await import(
      "~/lib/tanstack-db"
    );

    render(() => <CreateChannel />);
    const input = screen.getByPlaceholderText("New channel name");
    const form = input.closest("form")!;

    fireEvent.input(input, { target: { value: "test-channel" } });
    fireEvent.submit(form);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(channelsCollection.insert).toHaveBeenCalled();
    expect(channelMembersCollection.insert).toHaveBeenCalledTimes(2);
  });

  it("clears form after successful creation", async () => {
    const { channelsCollection } = await import("~/lib/tanstack-db");
    vi.mocked(channelsCollection.insert).mockReturnValue(
      ({ isPersisted: { promise: Promise.resolve() } }) as any,
    );

    render(() => <CreateChannel />);
    const input = screen.getByPlaceholderText(
      "New channel name"
    ) as HTMLInputElement;
    const form = input.closest("form")!;

    fireEvent.input(input, { target: { value: "test-channel" } });
    expect(input.value).toBe("test-channel");

    fireEvent.submit(form);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(input.value).toBe("");
  });

  it("requires minimum 2 characters", () => {
    render(() => <CreateChannel />);
    const input = screen.getByPlaceholderText(
      "New channel name"
    ) as HTMLInputElement;

    expect(input.minLength).toBe(2);
    expect(input.required).toBe(true);
  });

  it("validates channel name before submission", async () => {
    const { channelsCollection } = await import("~/lib/tanstack-db");

    render(() => <CreateChannel />);
    const input = screen.getByPlaceholderText("New channel name");
    const form = input.closest("form")!;

    // Try with single character (should be rejected by validation)
    fireEvent.input(input, { target: { value: "a" } });
    fireEvent.submit(form);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(channelsCollection.insert).not.toHaveBeenCalled();
  });
});
