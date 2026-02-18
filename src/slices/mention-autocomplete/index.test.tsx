import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { MentionAutocomplete } from "./index";

vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: (() => {
    let callCount = 0;
    return vi.fn(() => {
      callCount += 1;
      if (callCount % 2 === 1) {
        return Object.assign(
          () => [
            {
              member_type: "user",
              member_id: "user1",
              user_name: "alice",
              agent_name: null,
            },
            {
              member_type: "agent",
              member_id: "00000000-0000-0000-0000-000000000001",
              user_name: null,
              agent_name: "Assistant",
            },
          ],
          { isLoading: false, isReady: true },
        );
      }
      return Object.assign(
        () => [
          {
            id: "doc-1",
            title: "Project Plan",
            description: "Main plan",
          },
        ],
        { isLoading: false, isReady: true },
      );
    });
  })(),
  and: vi.fn(),
  coalesce: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("~/lib/tanstack-db", () => ({
  agentsCollection: {},
  channelMembersCollection: {},
  documentsCollection: {},
  usersCollection: {},
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
        mentionType="@"
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
        mentionType="@"
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
        mentionType="@"
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
        mentionType="@"
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
        mentionType="@"
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
