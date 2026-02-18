import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { DocumentViewer } from "./index";

// Mock dependencies
vi.mock("@tanstack/solid-db", () => ({
  useLiveQuery: vi.fn(() =>
    Object.assign(
      () => [
        {
          id: "test-doc",
          title: "Test Document",
          description: "A test document",
          content: "# Content\n\nTest content here",
        },
      ],
      { isLoading: false, isReady: true },
    ),
  ),
  eq: vi.fn(),
}));

vi.mock("~/lib/tanstack-db", () => ({
  documentsCollection: {},
}));

vi.mock("~/components/Markdown", () => ({
  RenderMarkdown: (props: { children: string }) => <div>{props.children}</div>,
}));

describe("DocumentViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders document title in header", () => {
    const onClose = vi.fn();
    render(() => <DocumentViewer documentId="test-doc" onClose={onClose} />);
    expect(screen.getByText("Test Document")).toBeInTheDocument();
  });

  it("renders close button", () => {
    const onClose = vi.fn();
    render(() => <DocumentViewer documentId="test-doc" onClose={onClose} />);
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(() => <DocumentViewer documentId="test-doc" onClose={onClose} />);
    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders document description", () => {
    const onClose = vi.fn();
    render(() => <DocumentViewer documentId="test-doc" onClose={onClose} />);
    expect(screen.getByText("A test document")).toBeInTheDocument();
  });

  it("renders document content", () => {
    const onClose = vi.fn();
    render(() => <DocumentViewer documentId="test-doc" onClose={onClose} />);
    expect(screen.getByText(/Test content here/)).toBeInTheDocument();
  });

  it("shows default title when document not loaded", async () => {
    const { useLiveQuery } = await import("@tanstack/solid-db");
    vi.mocked(useLiveQuery).mockReturnValueOnce(
      Object.assign(() => [], { isLoading: false, isReady: true }),
    );

    const onClose = vi.fn();
    render(() => <DocumentViewer documentId="test-doc" onClose={onClose} />);
    expect(screen.getByText("Document")).toBeInTheDocument();
  });
});
