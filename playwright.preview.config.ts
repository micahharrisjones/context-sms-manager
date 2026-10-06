import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Use Replit's supplied Chromium when available; elsewhere use Playwright's install.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./server/tests/browser",
  testMatch: "**/*.spec.ts",
  outputDir: "test-results/preview-browser",
  reporter: [["list"], ["html", { outputFolder: "playwright-report/previews", open: "never" }]],
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 7000 },
  use: {
    ...devices["iPhone 13"],
    browserName: "chromium",
    baseURL: "http://127.0.0.1:5017",
    serviceWorkers: "block",
    launchOptions: { executablePath },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "NODE_ENV=test PREVIEW_BROWSER_FIXTURES=1 npx tsx server/tests/browser/fixture-server.ts",
    url: "http://127.0.0.1:5017/__fixtures/ready",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
