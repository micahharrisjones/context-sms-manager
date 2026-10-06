import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["server/tests/preview-*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  resolve: { alias: {
    "@shared": path.resolve(__dirname, "shared"),
    "@": path.resolve(__dirname, "client/src"),
  } },
});
