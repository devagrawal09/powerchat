import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { UsernameRegistration } from "./index";

const { mockInsertValues, mockInsert } = vi.hoisted(() => {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  return {
    mockInsertValues: insertValues,
    mockInsert: vi.fn(() => ({ values: insertValues })),
  };
});

let existingUsers: Array<{ id: string }> = [];

vi.mock("~/db/client", () => ({
  clientDb: {
    insert: mockInsert,
  },
  liveQuery: (query: any) => query,
  users: {},
}));

vi.mock("~/lib/powersync-solid/hooks/useQuery", () => ({
  useQuery: vi.fn(() => () => ({
    data: existingUsers,
    isLoading: false,
    error: undefined,
  })),
}));

describe("UsernameRegistration", () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    existingUsers = [];
    document.cookie = "pc_username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  });

  it("renders registration form", () => {
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);
    expect(screen.getByText("Welcome to PowerChat")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("validates minimum username length", async () => {
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

  it("shows duplicate username error", async () => {
    existingUsers = [{ id: "alice" }];
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);

    const input = screen.getByPlaceholderText("Enter username");
    fireEvent.input(input, { target: { value: "Alice" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Username already taken")).toBeInTheDocument();
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("registers username and calls onSuccess", async () => {
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);

    const input = screen.getByPlaceholderText("Enter username");
    fireEvent.input(input, { target: { value: "testuser" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalledWith("testuser");
      expect(document.cookie).toContain("pc_username=testuser");
    });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ id: "testuser" }),
    );
  });

  it("disables button when username is too short", () => {
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);
    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Continue") as HTMLButtonElement;

    fireEvent.input(input, { target: { value: "ab" } });
    expect(button.disabled).toBe(true);
  });

  it("enables button when username is valid length", () => {
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);
    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Continue") as HTMLButtonElement;

    fireEvent.input(input, { target: { value: "abc" } });
    expect(button.disabled).toBe(false);
  });
});
