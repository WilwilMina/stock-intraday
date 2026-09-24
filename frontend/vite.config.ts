/// <reference types="vitest/config" />

// Vite dev/build config, plus the test config (Vitest reads the `test` key
// from this same file when no separate vitest.config.ts exists). The /api
// proxy lets the dev client call relative "/api/..." paths and never deal
// with CORS locally; VITE_API_BASE_URL is only needed for a deployed build.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    passWithNoTests: true,
  },
});
