import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { DeleteChannel } from "./index";

vi.mock("~/lib/powersync", () => ({
  writeTransaction: vi.fn(),
}));

describe("DeleteChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders delete button", () => {
    render(() => <DeleteChannel channelId="test-channel" />);
    const button = screen.getByLabelText("Delete channel");
    expect(button).toBeInTheDocument();
    expect(button.textContent).toBe("×");
  });

  it("calls writeTransaction on click", async () => {
    const { writeTransaction } = await import("~/lib/powersync");
    vi.mocked(writeTransaction).mockResolvedValue(undefined);

    render(() => <DeleteChannel channelId="test-channel" />);
    const button = screen.getByLabelText("Delete channel");

    fireEvent.click(button);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(writeTransaction).toHaveBeenCalled();
  });

  it("calls onDelete callback after deletion", async () => {
    const { writeTransaction } = await import("~/lib/powersync");
    vi.mocked(writeTransaction).mockResolvedValue(undefined);
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
