import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UsernameCheck } from "./index";

vi.mock("~/lib/getUsername", () => ({
  getUsername: vi.fn(() => "testuser"),
}));

describe("UsernameCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns username when available", () => {
    const result = UsernameCheck();
    expect(result.hasUsername()).toBe(true);
    expect(result.username()).toBe("testuser");
    expect(result.checking()).toBe(false);
  });

  it("returns null username when not available", async () => {
    const { getUsername } = await import("~/lib/getUsername");
    vi.mocked(getUsername).mockReturnValueOnce(null);

    const result = UsernameCheck();
    expect(result.hasUsername()).toBe(false);
    expect(result.username()).toBe(null);
  });
});
