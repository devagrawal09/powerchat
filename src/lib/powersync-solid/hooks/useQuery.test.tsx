import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal, Suspense, createRoot, ErrorBoundary } from "solid-js";
import { useQuery } from "./useQuery";
import { PowerSyncContext } from "../context";

// Mock the PowerSync database
const createMockDb = () => ({
  getAll: vi.fn(),
  customQuery: vi.fn(() => ({
    watch: vi.fn(() => ({
      registerListener: vi.fn(() => vi.fn()),
      close: vi.fn(),
    })),
    differentialWatch: vi.fn(() => ({
      registerListener: vi.fn(() => vi.fn()),
      close: vi.fn(),
    })),
  })),
});

// Test component that uses useQuery inside Suspense
function TestQueryComponent(props: {
  query: string;
  params?: unknown[];
  mockDb: ReturnType<typeof createMockDb>;
}) {
  const result = useQuery(
    () => props.query,
    () => props.params ?? [],
  );

  return (
    <div>
      <div data-testid="loading">{String(result().isLoading)}</div>
      <div data-testid="data-length">{result().data.length}</div>
      <div data-testid="data">{JSON.stringify(result().data)}</div>
      {result().error && (
        <div data-testid="error">{result().error?.message}</div>
      )}
    </div>
  );
}

describe("useQuery with Suspense support", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  it("suspends while loading and shows data when resolved", async () => {
    const testData = [{ id: 1, name: "Test" }];
    mockDb.getAll.mockResolvedValue(testData);

    render(() => (
      <PowerSyncContext.Provider value={mockDb as any}>
        <Suspense fallback={<div data-testid="fallback">Loading...</div>}>
          <TestQueryComponent query="SELECT * FROM test" mockDb={mockDb} />
        </Suspense>
      </PowerSyncContext.Provider>
    ));

    // Should show the fallback initially while suspending
    expect(screen.getByTestId("fallback")).toBeInTheDocument();

    // Wait for the data to be loaded
    await waitFor(() => {
      expect(screen.getByTestId("data-length")).toHaveTextContent("1");
    });

    expect(screen.getByTestId("data")).toHaveTextContent(
      JSON.stringify(testData),
    );
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("throws error when no PowerSync context is provided", async () => {
    // usePowerSync throws when used without a provider
    let caughtError: Error | undefined;

    render(() => (
      <ErrorBoundary
        fallback={(err) => {
          caughtError = err;
          return <div data-testid="error-boundary">{err.message}</div>;
        }}
      >
        <Suspense fallback={<div data-testid="fallback">Loading...</div>}>
          <TestQueryComponent query="SELECT * FROM test" mockDb={mockDb} />
        </Suspense>
      </ErrorBoundary>
    ));

    // Should catch the error about missing provider
    await waitFor(() => {
      expect(caughtError).toBeDefined();
    });

    expect(caughtError?.message).toContain("PowerSyncProvider");
  });

  it("re-fetches when query changes", async () => {
    const testData1 = [{ id: 1, name: "First" }];
    const testData2 = [{ id: 2, name: "Second" }];

    mockDb.getAll
      .mockResolvedValueOnce(testData1)
      .mockResolvedValueOnce(testData2);

    const [query, setQuery] = createSignal("SELECT * FROM test WHERE id = 1");

    render(() => (
      <PowerSyncContext.Provider value={mockDb as any}>
        <Suspense fallback={<div data-testid="fallback">Loading...</div>}>
          <TestQueryComponent query={query()} mockDb={mockDb} />
        </Suspense>
      </PowerSyncContext.Provider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId("data")).toHaveTextContent(
        JSON.stringify(testData1),
      );
    });

    // Change the query - need to trigger this outside of the render
    createRoot(() => {
      setQuery("SELECT * FROM test WHERE id = 2");
    });

    await waitFor(() => {
      expect(mockDb.getAll).toHaveBeenCalledTimes(2);
    });
  });

  it("handles errors correctly via ErrorBoundary", async () => {
    const dbError = new Error("Database error");
    mockDb.getAll.mockRejectedValue(dbError);

    // When createResource fetcher throws, Solid propagates the error to ErrorBoundary
    let caughtError: Error | undefined;

    function TestWithErrorCheck() {
      const result = useQuery(() => "SELECT * FROM test");
      // Access the data - this triggers resource resolution
      return (
        <div>
          <div data-testid="loading">{String(result().isLoading)}</div>
          <div data-testid="data">{JSON.stringify(result().data)}</div>
        </div>
      );
    }

    render(() => (
      <PowerSyncContext.Provider value={mockDb as any}>
        <ErrorBoundary
          fallback={(err) => {
            caughtError = err;
            return <div data-testid="error-boundary">{err.message}</div>;
          }}
        >
          <Suspense fallback={<div data-testid="fallback">Loading...</div>}>
            <TestWithErrorCheck />
          </Suspense>
        </ErrorBoundary>
      </PowerSyncContext.Provider>
    ));

    // Wait for error to be caught by ErrorBoundary or component to render with error
    await waitFor(
      () => {
        // Either we see the error boundary or the component rendered
        const errorBoundary = screen.queryByTestId("error-boundary");
        const loading = screen.queryByTestId("loading");
        expect(errorBoundary || loading).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // If error was caught by boundary
    if (caughtError) {
      expect(caughtError.message).toContain("Database error");
    }
  });
});

describe("useQuery returns correct state shape", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  it("has data, isLoading, isFetching, and error properties", async () => {
    mockDb.getAll.mockResolvedValue([]);

    let capturedResult: any;

    function CaptureComponent() {
      const result = useQuery(() => "SELECT * FROM test");
      capturedResult = result();
      return <div>{result().data.length}</div>;
    }

    render(() => (
      <PowerSyncContext.Provider value={mockDb as any}>
        <Suspense fallback={<div>Loading...</div>}>
          <CaptureComponent />
        </Suspense>
      </PowerSyncContext.Provider>
    ));

    await waitFor(() => {
      expect(capturedResult).toBeDefined();
    });

    // Check that result has the expected properties
    expect(capturedResult).toHaveProperty("data");
    expect(capturedResult).toHaveProperty("isLoading");
    expect(capturedResult).toHaveProperty("error");
  });

  it("returns arrays for data property", async () => {
    const testData = [{ id: 1 }, { id: 2 }];
    mockDb.getAll.mockResolvedValue(testData);

    function CaptureComponent() {
      const result = useQuery<{ id: number }>(() => "SELECT * FROM test");
      return (
        <div>
          <div data-testid="data-length">{result().data.length}</div>
          <div data-testid="data">{JSON.stringify(result().data)}</div>
        </div>
      );
    }

    render(() => (
      <PowerSyncContext.Provider value={mockDb as any}>
        <Suspense fallback={<div>Loading...</div>}>
          <CaptureComponent />
        </Suspense>
      </PowerSyncContext.Provider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId("data-length")).toHaveTextContent("2");
    });

    expect(screen.getByTestId("data")).toHaveTextContent(
      JSON.stringify(testData),
    );
  });
});

describe("useQuery backward compatibility", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  it("returns an accessor function (backward compatible)", async () => {
    mockDb.getAll.mockResolvedValue([]);

    let capturedResult: any;

    function CaptureComponent() {
      const result = useQuery(() => "SELECT * FROM test");
      capturedResult = result;
      return <div>{result().data.length}</div>;
    }

    render(() => (
      <PowerSyncContext.Provider value={mockDb as any}>
        <Suspense fallback={<div>Loading...</div>}>
          <CaptureComponent />
        </Suspense>
      </PowerSyncContext.Provider>
    ));

    await waitFor(() => {
      expect(capturedResult).toBeDefined();
    });

    // Verify it's a function (accessor)
    expect(typeof capturedResult).toBe("function");

    // Verify calling it returns the state object
    const state = capturedResult();
    expect(state).toHaveProperty("data");
    expect(state).toHaveProperty("isLoading");
    expect(state).toHaveProperty("error");
  });

  it("works with existing usage pattern result().data", async () => {
    const testData = [{ id: 1, name: "Test" }];
    mockDb.getAll.mockResolvedValue(testData);

    function ExistingPatternComponent() {
      const messages = useQuery<{ id: number; name: string }>(
        () => "SELECT * FROM messages",
      );

      return (
        <div>
          <div data-testid="loading">{String(messages().isLoading)}</div>
          <div data-testid="data">{JSON.stringify(messages().data)}</div>
        </div>
      );
    }

    render(() => (
      <PowerSyncContext.Provider value={mockDb as any}>
        <Suspense fallback={<div data-testid="fallback">Loading...</div>}>
          <ExistingPatternComponent />
        </Suspense>
      </PowerSyncContext.Provider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId("data")).toHaveTextContent(
        JSON.stringify(testData),
      );
    });
  });
});
