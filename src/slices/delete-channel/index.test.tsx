import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { DeleteChannel } from "./index";

vi.mock("~/lib/tanstack-db", () => ({
  channelsCollection: {
    delete: vi.fn(() => ({ isPersisted: { promise: Promise.resolve() } })),
  },
  ensureTanStackDbReady: vi.fn().mockResolvedValue(undefined),
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

  it("calls collection delete on click", async () => {
    const { channelsCollection } = await import("~/lib/tanstack-db");

    render(() => <DeleteChannel channelId="test-channel" />);
    const button = screen.getByLabelText("Delete channel");

    fireEvent.click(button);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(channelsCollection.delete).toHaveBeenCalledWith("test-channel");
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
