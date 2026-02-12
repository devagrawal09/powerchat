import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ChannelAgentsList } from "./index";

// Mock dependencies
vi.mock("~/lib/powersync-solid/hooks/useQuery", () => ({
  useQuery: vi.fn(() => () => ({
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
    isLoading: false,
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
    const { useQuery } = await import("~/lib/powersync-solid/hooks/useQuery");
    vi.mocked(useQuery).mockReturnValueOnce(() => ({
      data: [],
      isLoading: false,
    }));

    const onAgentClick = vi.fn();
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={onAgentClick} />
    ));
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
  });

  it("hides content while loading", async () => {
    const { useQuery } = await import("~/lib/powersync-solid/hooks/useQuery");
    vi.mocked(useQuery).mockReturnValueOnce(() => ({
      data: [],
      isLoading: true,
    }));

    const onAgentClick = vi.fn();
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={onAgentClick} />
    ));
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
  });
});
