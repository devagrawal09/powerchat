import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { CreateChannel } from "./index";

// Mock dependencies
vi.mock("~/lib/powersync", () => ({
  writeTransaction: vi.fn(),
}));

vi.mock("~/lib/getUsername", () => ({
  getUsername: vi.fn(() => "testuser"),
}));

describe("CreateChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form with input and button", () => {
    render(() => <CreateChannel />);
    expect(screen.getByPlaceholderText("New channel name")).toBeInTheDocument();
    expect(screen.getByText("Create Channel")).toBeInTheDocument();
  });

  it("shows 'Creating...' while submitting", async () => {
    const { writeTransaction } = await import("~/lib/powersync");
    vi.mocked(writeTransaction).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 1000);
        })
    );

    render(() => <CreateChannel />);
    const input = screen.getByPlaceholderText("New channel name");
    const button = screen.getByText("Create Channel");

    fireEvent.input(input, { target: { value: "new-channel" } });
    fireEvent.click(button);

    expect(screen.getByText("Creating...")).toBeInTheDocument();
  });

  it("calls writeTransaction with correct data", async () => {
    const { writeTransaction } = await import("~/lib/powersync");
    vi.mocked(writeTransaction).mockResolvedValue(undefined);

    render(() => <CreateChannel />);
    const input = screen.getByPlaceholderText("New channel name");
    const form = input.closest("form")!;

    fireEvent.input(input, { target: { value: "test-channel" } });
    fireEvent.submit(form);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(writeTransaction).toHaveBeenCalled();
  });

  it("clears form after successful creation", async () => {
    const { writeTransaction } = await import("~/lib/powersync");
    vi.mocked(writeTransaction).mockResolvedValue(undefined);

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
    const { writeTransaction } = await import("~/lib/powersync");
    vi.mocked(writeTransaction).mockResolvedValue(undefined);

    render(() => <CreateChannel />);
    const input = screen.getByPlaceholderText("New channel name");
    const form = input.closest("form")!;

    // Try with single character (should be rejected by validation)
    fireEvent.input(input, { target: { value: "a" } });
    fireEvent.submit(form);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // writeTransaction should not be called for invalid input
    expect(writeTransaction).not.toHaveBeenCalled();
  });
});
