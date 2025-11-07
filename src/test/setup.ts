import "@testing-library/jest-dom";
import { cleanup } from "@solidjs/testing-library";
import { afterEach } from "vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
});
