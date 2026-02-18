import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { AgentViewer } from "./index";

// Mock dependencies
vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: vi.fn(() =>
    Object.assign(
      () => [
        {
          id: "test-agent",
          name: "Test Agent",
          description: "A test agent",
          system_instructions: "# Instructions\n\nTest instructions",
        },
      ],
      { isLoading: false, isReady: true },
    ),
  ),
  eq: vi.fn(),
}));

vi.mock("~/lib/tanstack-db", () => ({
  agentsCollection: {},
}));

vi.mock("~/components/Markdown", () => ({
  RenderMarkdown: (props: { children: string }) => <div>{props.children}</div>,
}));

describe("AgentViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders agent name in header", () => {
    const onClose = vi.fn();
    render(() => <AgentViewer agentId="test-agent" onClose={onClose} />);
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
  });

  it("renders close button", () => {
    const onClose = vi.fn();
    render(() => <AgentViewer agentId="test-agent" onClose={onClose} />);
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(() => <AgentViewer agentId="test-agent" onClose={onClose} />);
    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders agent description", () => {
    const onClose = vi.fn();
    render(() => <AgentViewer agentId="test-agent" onClose={onClose} />);
    expect(screen.getByText("A test agent")).toBeInTheDocument();
  });

  it("renders system instructions section", () => {
    const onClose = vi.fn();
    render(() => <AgentViewer agentId="test-agent" onClose={onClose} />);
    expect(screen.getByText("System Instructions")).toBeInTheDocument();
  });

  it("shows default name when agent not loaded", async () => {
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [], { isLoading: false, isReady: true }),
    );

    const onClose = vi.fn();
    render(() => <AgentViewer agentId="test-agent" onClose={onClose} />);
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });
});
