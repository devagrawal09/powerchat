import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { MentionAutocomplete } from "./index";

vi.mock("~/lib/useWatchedQuery", () => ({
  useWatchedQuery: vi.fn(() => ({
    data: [
      { member_type: "user", member_id: "user1", name: "alice" },
      {
        member_type: "agent",
        member_id: "00000000-0000-0000-0000-000000000001",
        name: "Assistant",
      },
    ],
    loading: false,
  })),
}));

describe("MentionAutocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(() => (
      <MentionAutocomplete
        channelId="test-channel"
        mentionQuery=""
        isOpen={false}
        activeIndex={0}
        onSelect={vi.fn()}
        onActiveIndexChange={vi.fn()}
      />
    ));
    expect(screen.queryByText("@Assistant")).not.toBeInTheDocument();
  });

  it("renders filtered options when open", () => {
    render(() => (
      <MentionAutocomplete
        channelId="test-channel"
        mentionQuery="ass"
        isOpen={true}
        activeIndex={0}
        onSelect={vi.fn()}
        onActiveIndexChange={vi.fn()}
      />
    ));
    expect(screen.getByText("@Assistant")).toBeInTheDocument();
    expect(screen.queryByText("@alice")).not.toBeInTheDocument();
  });

  it("calls onSelect when option is clicked", () => {
    const onSelect = vi.fn();
    render(() => (
      <MentionAutocomplete
        channelId="test-channel"
        mentionQuery=""
        isOpen={true}
        activeIndex={0}
        onSelect={onSelect}
        onActiveIndexChange={vi.fn()}
      />
    ));

    const button = screen.getByText("@Assistant").closest("button");
    fireEvent.mouseDown(button!);

    expect(onSelect).toHaveBeenCalledWith("Assistant");
  });

  it("calls onActiveIndexChange on hover", () => {
    const onActiveIndexChange = vi.fn();
    render(() => (
      <MentionAutocomplete
        channelId="test-channel"
        mentionQuery=""
        isOpen={true}
        activeIndex={0}
        onSelect={vi.fn()}
        onActiveIndexChange={onActiveIndexChange}
      />
    ));

    const button = screen.getByText("@alice").closest("button");
    fireEvent.mouseEnter(button!);

    expect(onActiveIndexChange).toHaveBeenCalled();
  });

  it("highlights active index", () => {
    render(() => (
      <MentionAutocomplete
        channelId="test-channel"
        mentionQuery=""
        isOpen={true}
        activeIndex={0}
        onSelect={vi.fn()}
        onActiveIndexChange={vi.fn()}
      />
    ));

    const firstButton = screen.getByText("@alice").closest("button");
    expect(firstButton?.classList.contains("bg-blue-50")).toBe(true);
  });
});
