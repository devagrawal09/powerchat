import { fireEvent, render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChannelPage from "./[id]";

const { mockNavigate, mockUseQuery } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseQuery: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ id: "channel-1" }),
  useNavigate: () => mockNavigate,
}));

vi.mock("~/db/client", () => ({
  channels: { id: "id" },
  clientDb: {
    select: () => ({
      from: () => ({
        where: () => ({ query: "channel" }),
      }),
    }),
  },
  liveQuery: (query: unknown) => query,
}));

vi.mock("~/lib/powersync-solid", () => ({
  useQuery: mockUseQuery,
}));

vi.mock("~/slices/channel-member-list", () => ({
  ChannelMemberList: () => <div>Members</div>,
}));
vi.mock("~/slices/channel-agents-list", () => ({
  ChannelAgentsList: (props: { onAgentClick: (agentId: string) => void }) => (
    <button type="button" onClick={() => props.onAgentClick("agent-1")}>
      Open agent
    </button>
  ),
}));
vi.mock("~/slices/channel-invite", () => ({
  ChannelInvite: () => <div>Invite</div>,
}));
vi.mock("~/slices/channel-header", () => ({
  ChannelHeader: () => <div>Header</div>,
}));
vi.mock("~/slices/create-agent", () => ({
  CreateAgent: () => <div>Create agent</div>,
}));
vi.mock("~/slices/chat-messages", () => ({
  ChatMessages: () => <div>Messages</div>,
}));
vi.mock("~/slices/chat-input", () => ({
  ChatInput: () => <div>Input</div>,
}));
vi.mock("~/slices/agent-viewer", () => ({
  AgentViewer: (props: { agentId: string; onClose: () => void }) => (
    <div>
      <div>{`Agent viewer: ${props.agentId}`}</div>
      <button type="button" onClick={props.onClose}>
        Close agent
      </button>
    </div>
  ),
}));
vi.mock("~/slices/channel-workspace-tree", () => ({
  ChannelWorkspaceTree: (props: {
    onFileSelect: (file: { path: string; name: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        props.onFileSelect({
          path: "docs/readme.md",
          name: "readme.md",
        })}
    >
      Open file
    </button>
  ),
}));
vi.mock("~/slices/workspace-file-viewer", () => ({
  WorkspaceFileViewer: (props: { filePath: string; onClose: () => void }) => (
    <div>
      <div>{`File viewer: ${props.filePath}`}</div>
      <button type="button" onClick={props.onClose}>
        Close file
      </button>
    </div>
  ),
}));

describe("ChannelPage inspector state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(() => ({
      data: [{ id: "channel-1" }],
      isLoading: false,
    }));
  });

  it("switches between agent and file viewers in one inspector slot", () => {
    render(() => <ChannelPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open agent" }));
    expect(screen.getByText("Agent viewer: agent-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open file" }));
    expect(screen.getByText("File viewer: docs/readme.md")).toBeInTheDocument();
    expect(screen.queryByText("Agent viewer: agent-1")).not.toBeInTheDocument();
  });
});
