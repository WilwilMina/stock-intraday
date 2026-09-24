import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The first route test builds the Fastify app cold. That normally takes
    // well under a second, but it once took 6.8s on a busy machine, past
    // Vitest's 5s default.
    testTimeout: 15000,
  },
});
