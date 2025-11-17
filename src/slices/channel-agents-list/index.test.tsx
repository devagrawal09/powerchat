import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ChannelAgentsList } from "./index";

// Mock dependencies
vi.mock("~/lib/useWatchedQuery", () => ({
  useWatchedQuery: vi.fn(() => ({
    data: [
      {
        member_type: "agent",
        member_id: "agent-1",
        name: "Assistant",
      },
      {
        member_type: "agent",
        member_id: "agent-2",
        name: "Researcher",
      },
    ],
    loading: false,
  })),
}));

describe("ChannelAgentsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders agents section header", () => {
    const onAgentClick = vi.fn();
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={onAgentClick} />
    ));
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("renders list of agents", () => {
    const onAgentClick = vi.fn();
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={onAgentClick} />
    ));
    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("Researcher")).toBeInTheDocument();
  });

  it("calls onAgentClick when agent is clicked", () => {
    const onAgentClick = vi.fn();
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={onAgentClick} />
    ));
    const assistant = screen.getByText("Assistant");
    fireEvent.click(assistant);
    expect(onAgentClick).toHaveBeenCalledWith("agent-1");
  });

  it("handles empty agent list", async () => {
    const { useWatchedQuery } = await import("~/lib/useWatchedQuery");
    vi.mocked(useWatchedQuery).mockReturnValueOnce({
      data: [],
      loading: false,
    });

    const onAgentClick = vi.fn();
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={onAgentClick} />
    ));
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
  });

  it("hides content while loading", async () => {
    const { useWatchedQuery } = await import("~/lib/useWatchedQuery");
    vi.mocked(useWatchedQuery).mockReturnValueOnce({
      data: [],
      loading: true,
    });

    const onAgentClick = vi.fn();
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={onAgentClick} />
    ));
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
  });
});
