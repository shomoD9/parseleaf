/**
 * This file configures the test runner. It exists separately so test discovery
 * stays explicit and does not depend on Vitest defaults that may drift over time.
 * The repository tooling imports this file when running `npm test`.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"]
  }
});
