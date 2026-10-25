/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
