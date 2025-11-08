import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { UsernameRegistration } from "./index";

// Mock dependencies
vi.mock("@solidjs/router", () => ({
  useAction: vi.fn(() => vi.fn()),
  useSubmission: vi.fn(() => ({ pending: false })),
}));

vi.mock("~/server/actions", () => ({
  registerUsername: vi.fn(),
}));

describe("UsernameRegistration", () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document.cookie
    document.cookie = "pc_username=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
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
    const button = screen.getByText("Continue");

    fireEvent.input(input, { target: { value: "ab" } });
    fireEvent.submit(button.closest("form")!);

    await waitFor(() => {
      expect(
        screen.getByText("Username must be at least 3 characters")
      ).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it("validates maximum username length", async () => {
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);

    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Continue");

    fireEvent.input(input, { target: { value: "a".repeat(31) } });
    fireEvent.submit(button.closest("form")!);

    await waitFor(() => {
      expect(
        screen.getByText("Username must be less than 30 characters")
      ).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it("validates username format - only allows alphanumeric, hyphens, underscores", async () => {
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);

    const input = screen.getByPlaceholderText("Enter username");
    const button = screen.getByText("Continue");

    fireEvent.input(input, { target: { value: "user@name" } });
    fireEvent.submit(button.closest("form")!);

    await waitFor(() => {
      // Look for the error message specifically (not the help text)
      const errorMessage = screen.getByText(
        "Username can only contain letters, numbers, hyphens, and underscores"
      );
      expect(errorMessage).toHaveClass("text-red-600");
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it("accepts valid username with letters, numbers, hyphens, and underscores", async () => {
    const { useAction } = await import("@solidjs/router");
    const mockRegister = vi.fn().mockResolvedValue({
      success: true,
      username: "test-user_123",
    });
    vi.mocked(useAction).mockReturnValue(mockRegister);

    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);

    const input = screen.getByPlaceholderText("Enter username");
    const form = input.closest("form")!;

    fireEvent.input(input, { target: { value: "test-user_123" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });
  });

  it("calls onSuccess with username after successful registration", async () => {
    const { useAction } = await import("@solidjs/router");
    const mockRegister = vi.fn().mockResolvedValue({
      success: true,
      username: "testuser",
    });
    vi.mocked(useAction).mockReturnValue(mockRegister);

    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);

    const input = screen.getByPlaceholderText("Enter username");
    const form = input.closest("form")!;

    fireEvent.input(input, { target: { value: "testuser" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith("testuser");
    });
  });

  it("sets cookie after successful registration", async () => {
    const { useAction } = await import("@solidjs/router");
    const mockRegister = vi.fn().mockResolvedValue({
      success: true,
      username: "testuser",
    });
    vi.mocked(useAction).mockReturnValue(mockRegister);

    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);

    const input = screen.getByPlaceholderText("Enter username");
    const form = input.closest("form")!;

    fireEvent.input(input, { target: { value: "testuser" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(document.cookie).toContain("pc_username=testuser");
    });
  });

  it("displays error message when server returns error", async () => {
    const { useAction } = await import("@solidjs/router");
    const mockRegister = vi.fn().mockResolvedValue({
      error: "Username already taken",
    });
    vi.mocked(useAction).mockReturnValue(mockRegister);

    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);

    const input = screen.getByPlaceholderText("Enter username");
    const form = input.closest("form")!;

    fireEvent.input(input, { target: { value: "testuser" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Username already taken")).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
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

  it("trims whitespace from username before validation", async () => {
    render(() => <UsernameRegistration onSuccess={mockOnSuccess} />);

    const input = screen.getByPlaceholderText("Enter username");
    const form = input.closest("form")!;

    fireEvent.input(input, { target: { value: "  ab  " } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText("Username must be at least 3 characters")
      ).toBeInTheDocument();
    });
  });
});
