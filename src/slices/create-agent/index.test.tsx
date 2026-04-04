import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { CreateAgent } from "./index";

const { mockInsertValues, mockInsert } = vi.hoisted(() => ({
  mockInsertValues: vi.fn().mockResolvedValue(undefined),
  mockInsert: vi.fn(),
}));

vi.mock("~/db/client", () => ({
  agents: {},
  clientDb: {
    insert: mockInsert,
  },
  liveQuery: (query: any) => query,
}));

vi.mock("~/lib/powersync-solid/hooks/useQuery", () => ({
  useQuery: vi.fn(() => () => ({
    data: [],
    isLoading: false,
  })),
}));

describe("CreateAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ values: mockInsertValues });
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

  it("keeps submit disabled when fields are empty", async () => {
    render(() => <CreateAgent channelId="test-channel" />);
    const button = screen.getByText("Create Agent");
    fireEvent.click(button);
    const submitButton = screen.getByText("Create") as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText("All fields are required")).not.toBeInTheDocument();
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
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it("shows success message after creation", async () => {
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
    const onSuccess = vi.fn();

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
