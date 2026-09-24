// Registers jest-dom's matchers (toBeInTheDocument, etc.) for every test
// file, and extends Vitest's `expect` types to match. Also unmounts each
// test's rendered tree afterward: React Testing Library's own auto-cleanup
// relies on a *global* afterEach, which doesn't exist here since vitest.config
// doesn't set `globals: true` (test files import from "vitest" explicitly,
// matching the backend's style) - so cleanup is wired by hand instead.

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});
