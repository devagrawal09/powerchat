import { describe, it, expect, vi, beforeEach } from "vitest";
import { UsernameCheck } from "./index";

const mockSession = vi.hoisted(() => ({
  username: vi.fn<() => string | null>(() => "testuser"),
  setUsername: vi.fn(),
}));

vi.mock("~/lib/session", () => ({
  useSession: () => mockSession,
}));

describe("UsernameCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.username.mockReturnValue("testuser");
  });

  it("returns username when available", () => {
    const result = UsernameCheck();
    expect(result.hasUsername()).toBe(true);
    expect(result.username()).toBe("testuser");
    expect(result.checking()).toBe(false);
  });

  it("returns null username when not available", () => {
    mockSession.username.mockReturnValue(null);

    const result = UsernameCheck();
    expect(result.hasUsername()).toBe(false);
    expect(result.username()).toBe(null);
  });
});
