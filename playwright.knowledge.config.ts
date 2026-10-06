import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./server/tests/browser",
  testMatch: "knowledge.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/knowledge-browser",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: "http://127.0.0.1:5000",
    timezoneId: "America/Los_Angeles",
    screenshot: "off",
    video: "off",
    trace: "off",
    // Use Replit's Nix-wrapped browser; downloaded Linux builds lack its libraries.
    launchOptions: { executablePath: existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined },
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
      },
    },
  ],
});
