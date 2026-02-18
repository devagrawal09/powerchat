import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ChannelAgentsList } from "./index";

// Mock dependencies
vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: vi.fn(() =>
    Object.assign(
      () => [
        {
          member_id: "agent-1",
          agent_name: "Assistant",
        },
        {
          member_id: "agent-2",
          agent_name: "Researcher",
        },
      ],
      { isLoading: false, isReady: true },
    ),
  ),
  and: vi.fn(),
  coalesce: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("~/lib/tanstack-db", () => ({
  agentsCollection: {},
  channelMembersCollection: {},
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
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [], { isLoading: false, isReady: true }),
    );

    const onAgentClick = vi.fn();
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={onAgentClick} />
    ));
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
  });

  it("hides content while loading", async () => {
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [], { isLoading: true, isReady: false }),
    );

    const onAgentClick = vi.fn();
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={onAgentClick} />
    ));
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
  });
});
