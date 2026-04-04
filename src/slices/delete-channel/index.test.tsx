import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { DeleteChannel } from "./index";

const { mockWhere, mockDelete } = vi.hoisted(() => ({
  mockWhere: vi.fn().mockResolvedValue(undefined),
  mockDelete: vi.fn(),
}));

vi.mock("~/db/client", () => ({
  channels: {},
  clientDb: {
    delete: mockDelete,
  },
}));

describe("DeleteChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  it("renders delete button", () => {
    render(() => <DeleteChannel channelId="test-channel" />);
    const button = screen.getByLabelText("Delete channel");
    expect(button).toBeInTheDocument();
    expect(button.textContent).toBe("×");
  });

  it("calls writeTransaction on click", async () => {
    render(() => <DeleteChannel channelId="test-channel" />);
    const button = screen.getByLabelText("Delete channel");

    fireEvent.click(button);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockDelete).toHaveBeenCalled();
  });

  it("calls onDelete callback after deletion", async () => {
    const onDelete = vi.fn();

    render(() => (
      <DeleteChannel channelId="test-channel" onDelete={onDelete} />
    ));
    const button = screen.getByLabelText("Delete channel");

    fireEvent.click(button);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onDelete).toHaveBeenCalled();
  });
});
