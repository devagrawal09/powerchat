import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { UsernameRegistration } from "./index";

vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: vi.fn(() =>
    Object.assign(() => [], { isLoading: false, isReady: true }),
  ),
}));

vi.mock("~/lib/tanstack-db", () => ({
  ensureTanStackDbReady: vi.fn().mockResolvedValue(undefined),
  usersCollection: {
    insert: vi.fn(() => ({ isPersisted: { promise: Promise.resolve() } })),
  },
}));

describe("UsernameRegistration", () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "pc_username=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
  });

  it("renders form", () => {
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);
    expect(screen.getByText("Welcome to PowerChat")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
  });

  it("validates minimum length", async () => {
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);
    const input = screen.getByPlaceholderText("Enter username");
    fireEvent.input(input, { target: { value: "ab" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => {
      expect(
        screen.getByText("Username must be at least 3 characters"),
      ).toBeInTheDocument();
    });
  });

  it("validates username format", async () => {
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);
    const input = screen.getByPlaceholderText("Enter username");
    fireEvent.input(input, { target: { value: "user@name" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => {
      expect(
        screen.getByText(
          "Username can only contain letters, numbers, hyphens, and underscores",
        ),
      ).toBeInTheDocument();
    });
  });

  it("validates duplicate usernames from live query", async () => {
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [{ id: "taken-user" }], {
        isLoading: false,
        isReady: true,
      }),
    );

    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);
    const input = screen.getByPlaceholderText("Enter username");
    fireEvent.input(input, { target: { value: "taken-user" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => {
      expect(screen.getByText("Username already taken")).toBeInTheDocument();
    });
  });

  it("inserts user and calls onSuccess", async () => {
    const { usersCollection } = await import("~/lib/tanstack-db");
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);
    const input = screen.getByPlaceholderText("Enter username");
    fireEvent.input(input, { target: { value: "testuser" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(usersCollection.insert).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalledWith("testuser");
      expect(document.cookie).toContain("pc_username=testuser");
    });
  });
});
