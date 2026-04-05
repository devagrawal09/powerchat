import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ChannelAgentsList } from "./index";

let queryCallCount = 0;

vi.mock("~/lib/powersync-solid/hooks/useQuery", () => ({
  useQuery: vi.fn(() => {
    queryCallCount += 1;
    if (queryCallCount % 2 === 1) {
      return () => ({
        data: [
          { member_type: "agent", member_id: "agent-1", name: "Assistant" },
          { member_type: "agent", member_id: "agent-2", name: "Researcher" },
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

describe("ChannelAgentsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallCount = 0;
  });

  it("renders agents section header", () => {
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={vi.fn()} />
    ));

    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("renders list of agents", () => {
    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={vi.fn()} />
    ));

    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("Researcher")).toBeInTheDocument();
  });

  it("calls onAgentClick when agent is clicked", () => {
    const onAgentClick = vi.fn();

    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={onAgentClick} />
    ));

    fireEvent.click(screen.getByText("Assistant"));

    expect(onAgentClick).toHaveBeenCalledWith("agent-1");
  });

  it("handles empty agent list", async () => {
    const { useQuery } = await import("~/lib/powersync-solid/hooks/useQuery");
    vi.mocked(useQuery).mockImplementation(() => () => ({
      data: [],
      isLoading: false,
    }));

    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={vi.fn()} />
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

    render(() => (
      <ChannelAgentsList channelId="test-channel" onAgentClick={vi.fn()} />
    ));

    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.queryByText("Assistant")).not.toBeInTheDocument();
  });
});
