import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ChannelAgentsList } from "./index";

// Track call count to return different data for agents vs active runs queries
let queryCallCount = 0;

// Mock dependencies
vi.mock("~/lib/powersync-solid/hooks/useQuery", () => ({
  useQuery: vi.fn(() => {
    queryCallCount++;
    // First call is agents, second call is active runs
    if (queryCallCount % 2 === 1) {
      return () => ({
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
      });
    }
    return () => ({
      data: [],
      isLoading: false,
    });
  }),
}));

vi.mock("~/server/stop-agent", () => ({
  stopAgent: vi.fn(),
}));

describe("ChannelAgentsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallCount = 0;
  });

  it("renders agents section header", () => {
    const onAgentClick = vi.fn();
    const onTraceClick = vi.fn();
    render(() => (
      <ChannelAgentsList
        channelId="test-channel"
        onAgentClick={onAgentClick}
        onTraceClick={onTraceClick}
      />
    ));
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("renders list of agents", () => {
    const onAgentClick = vi.fn();
    const onTraceClick = vi.fn();
    render(() => (
      <ChannelAgentsList
        channelId="test-channel"
        onAgentClick={onAgentClick}
        onTraceClick={onTraceClick}
      />
    ));
    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("Researcher")).toBeInTheDocument();
  });

  it("calls onAgentClick when non-running agent is clicked", () => {
    const onAgentClick = vi.fn();
    const onTraceClick = vi.fn();
    render(() => (
      <ChannelAgentsList
        channelId="test-channel"
        onAgentClick={onAgentClick}
        onTraceClick={onTraceClick}
      />
    ));
    const assistant = screen.getByText("Assistant");
    fireEvent.click(assistant);
    expect(onAgentClick).toHaveBeenCalledWith("agent-1");
  });

  it("handles empty agent list", async () => {
    const { useQuery } = await import("~/lib/powersync-solid/hooks/useQuery");
    vi.mocked(useQuery).mockImplementation(() => () => ({
      data: [],
      isLoading: false,
    }));

    const onAgentClick = vi.fn();
    const onTraceClick = vi.fn();
    render(() => (
      <ChannelAgentsList
        channelId="test-channel"
        onAgentClick={onAgentClick}
        onTraceClick={onTraceClick}
      />
    ));
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
  });

  it("hides content while loading", async () => {
    const { useQuery } = await import("~/lib/powersync-solid/hooks/useQuery");
    vi.mocked(useQuery).mockImplementation(() => () => ({
      data: [],
      isLoading: true,
    }));

    const onAgentClick = vi.fn();
    const onTraceClick = vi.fn();
    render(() => (
      <ChannelAgentsList
        channelId="test-channel"
        onAgentClick={onAgentClick}
        onTraceClick={onTraceClick}
      />
    ));
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
  });
});
