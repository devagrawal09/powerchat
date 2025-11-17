import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { CreateAgent } from "./index";

// Mock dependencies
vi.mock("~/lib/powersync", () => ({
  writeTransaction: vi.fn(),
}));

vi.mock("~/lib/useWatchedQuery", () => ({
  useWatchedQuery: vi.fn(() => ({
    data: [],
    loading: false,
  })),
}));

describe("CreateAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders create button when closed", () => {
    render(() => <CreateAgent channelId="test-channel" />);
    expect(screen.getByText("Create Agent")).toBeInTheDocument();
  });

  it("opens form when create button is clicked", () => {
    render(() => <CreateAgent channelId="test-channel" />);
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    expect(screen.getByText("Create Agent")).toBeInTheDocument(); // Title in form
    expect(screen.getByPlaceholderText("Agent name")).toBeInTheDocument();
  });

  it("renders all form fields", () => {
    render(() => <CreateAgent channelId="test-channel" />);
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    expect(screen.getByPlaceholderText("Agent name")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("System instructions")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Description (visible to other agents)")
    ).toBeInTheDocument();
  });

  it("disables submit button when fields are empty", () => {
    render(() => <CreateAgent channelId="test-channel" />);
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    const submitButton = screen.getByText("Create") as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it("enables submit button when all fields are filled", () => {
    render(() => <CreateAgent channelId="test-channel" />);
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    const nameInput = screen.getByPlaceholderText("Agent name");
    const instructionsInput = screen.getByPlaceholderText(
      "System instructions"
    );
    const descriptionInput = screen.getByPlaceholderText(
      "Description (visible to other agents)"
    );
    const submitButton = screen.getByText("Create") as HTMLButtonElement;

    fireEvent.input(nameInput, { target: { value: "TestAgent" } });
    fireEvent.input(instructionsInput, { target: { value: "Instructions" } });
    fireEvent.input(descriptionInput, { target: { value: "Description" } });

    expect(submitButton.disabled).toBe(false);
  });

  it("shows validation error for empty name", async () => {
    render(() => <CreateAgent channelId="test-channel" />);
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    const submitButton = screen.getByText("Create");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("All fields are required")).toBeInTheDocument();
    });
  });

  it("shows validation error for short name", async () => {
    render(() => <CreateAgent channelId="test-channel" />);
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    const nameInput = screen.getByPlaceholderText("Agent name");
    const instructionsInput = screen.getByPlaceholderText(
      "System instructions"
    );
    const descriptionInput = screen.getByPlaceholderText(
      "Description (visible to other agents)"
    );
    const submitButton = screen.getByText("Create");

    fireEvent.input(nameInput, { target: { value: "A" } });
    fireEvent.input(instructionsInput, { target: { value: "Instructions" } });
    fireEvent.input(descriptionInput, { target: { value: "Description" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Agent name must be at least 2 characters")
      ).toBeInTheDocument();
    });
  });

  it("calls writeTransaction on successful submission", async () => {
    const { writeTransaction } = await import("~/lib/powersync");
    vi.mocked(writeTransaction).mockResolvedValue(undefined);

    render(() => <CreateAgent channelId="test-channel" />);
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    const nameInput = screen.getByPlaceholderText("Agent name");
    const instructionsInput = screen.getByPlaceholderText(
      "System instructions"
    );
    const descriptionInput = screen.getByPlaceholderText(
      "Description (visible to other agents)"
    );
    const form = nameInput.closest("form")!;

    fireEvent.input(nameInput, { target: { value: "TestAgent" } });
    fireEvent.input(instructionsInput, { target: { value: "Instructions" } });
    fireEvent.input(descriptionInput, { target: { value: "Description" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(writeTransaction).toHaveBeenCalled();
    });
  });

  it("shows success message after creation", async () => {
    const { writeTransaction } = await import("~/lib/powersync");
    vi.mocked(writeTransaction).mockResolvedValue(undefined);

    render(() => <CreateAgent channelId="test-channel" />);
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    const nameInput = screen.getByPlaceholderText("Agent name");
    const instructionsInput = screen.getByPlaceholderText(
      "System instructions"
    );
    const descriptionInput = screen.getByPlaceholderText(
      "Description (visible to other agents)"
    );
    const form = nameInput.closest("form")!;

    fireEvent.input(nameInput, { target: { value: "TestAgent" } });
    fireEvent.input(instructionsInput, { target: { value: "Instructions" } });
    fireEvent.input(descriptionInput, { target: { value: "Description" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText('Agent "TestAgent" created!')
      ).toBeInTheDocument();
    });
  });

  it("calls onSuccess callback after creation", async () => {
    const { writeTransaction } = await import("~/lib/powersync");
    const onSuccess = vi.fn();
    vi.mocked(writeTransaction).mockResolvedValue(undefined);

    render(() => (
      <CreateAgent channelId="test-channel" onSuccess={onSuccess} />
    ));
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    const nameInput = screen.getByPlaceholderText("Agent name");
    const instructionsInput = screen.getByPlaceholderText(
      "System instructions"
    );
    const descriptionInput = screen.getByPlaceholderText(
      "Description (visible to other agents)"
    );
    const form = nameInput.closest("form")!;

    fireEvent.input(nameInput, { target: { value: "TestAgent" } });
    fireEvent.input(instructionsInput, { target: { value: "Instructions" } });
    fireEvent.input(descriptionInput, { target: { value: "Description" } });
    fireEvent.submit(form);

    await waitFor(
      () => {
        expect(onSuccess).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  });

  it("closes form when cancel is clicked", () => {
    render(() => <CreateAgent channelId="test-channel" />);
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);
    expect(screen.queryByPlaceholderText("Agent name")).not.toBeInTheDocument();
  });
});
