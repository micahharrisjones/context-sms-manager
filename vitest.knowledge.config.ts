import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { environment: "node", include: ["server/tests/knowledge-*.test.ts"], testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
  resolve: { alias: { "@shared": path.resolve(__dirname, "shared"), "@": path.resolve(__dirname, "client/src") } },
});
