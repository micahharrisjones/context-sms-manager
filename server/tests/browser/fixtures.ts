import { test as base, expect, type Page, type TestInfo } from "@playwright/test";
import type { Message } from "../../../shared/schema";

export const urls = {
  old: "https://example.org/old",
  current: "https://example.org/current",
  second: "https://example.org/second",
  instagram: "https://www.instagram.com/p/DcmCeLDGvLm/",
  imdb: "https://www.imdb.com/title/tt3647214/",
  reddit: "https://www.reddit.com/r/fixtures/comments/abc123/example/",
  tiktok: "https://www.tiktok.com/@fixture/video/7123456789012345678",
};
export function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 900003, userId: 900001, senderId: "fixture", content: urls.current,
    tags: ["previews"], timestamp: new Date("2026-01-01T12:00:00Z"),
    ogTitle: null, ogDescription: null, ogImage: null, ogSourceUrl: null,
    ...overrides,
  } as Message;
}

type PreviewOptions = {
  og?: Record<string, unknown>;
  tmdb?: "miss" | "network" | Record<string, unknown>;
  embed?: "loaded" | "blank" | "network";
};
export type Harness = {
  open: (route: string, messages: Message[], options?: PreviewOptions) => Promise<void>;
  requests: string[];
  unexpected: string[];
};

export const test = base.extend<{ harness: Harness }>({
  harness: async ({ page, context }, use) => {
    const requests: string[] = [];
    const unexpected: string[] = [];
    let options: PreviewOptions = {};
    await page.clock.install({ time: new Date("2026-01-01T12:00:00Z") });
    // Stop SDK telemetry without changing the application or using real user IDs.
    await page.addInitScript(() => {
      (window as any).pendo = {
        initialize() {}, identify() {}, pageLoad() {}, track() {}, clearVisitor() {},
      };
    });
    await context.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const local = url.origin === "http://127.0.0.1:5017";
      if (local && url.pathname === "/api/og-preview") {
        requests.push(url.pathname + url.search);
        return route.fulfill({ json: options.og || { skip: true } });
      }
      if (local && url.pathname.startsWith("/api/tmdb/movie/")) {
        requests.push(url.pathname);
        if (options.tmdb === "network") return route.abort("failed");
        return route.fulfill({
          status: !options.tmdb || options.tmdb === "miss" ? 404 : 200,
          json: typeof options.tmdb === "object" ? options.tmdb : { error: "Catalogue miss" },
        });
      }
      if (url.pathname.startsWith("/__images/")) {
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#b95827"/><text x="30" y="120" fill="white" font-size="26">Fixture thumbnail</text></svg>',
        });
      }
      if (local) {
        const allowedApi = /^(\/api\/(auth\/session|profile|tags|shared-boards|messages|admin\/stats|admin\/feedback\/unread-count))(\/|$)/;
        if (url.pathname.startsWith("/api/") && !allowedApi.test(url.pathname)) {
          unexpected.push(request.url());
          return route.abort();
        }
        return route.continue();
      }
      if (url.hostname === "embed.reddit.com" || (url.hostname === "www.tiktok.com" && url.pathname.startsWith("/embed/"))) {
        if (options.embed === "network") return route.abort("failed");
        return route.fulfill({
          contentType: "text/html",
          body: options.embed === "loaded"
            ? '<!doctype html><body style="background:#f5e4da;font-family:sans-serif;padding:20px"><h2>Fixture embed loaded</h2></body>'
            : "<!doctype html><body></body>",
        });
      }
      // Analytics scripts are deliberately inert, all other external traffic fails.
      if (url.hostname === "cdn.pendo.io" || url.hostname.endsWith("replit.com")) {
        return route.fulfill({ contentType: "application/javascript", body: "" });
      }
      unexpected.push(request.url());
      return route.abort("blockedbyclient");
    });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await use({
      requests, unexpected,
      async open(route, messages, previewOptions = {}) {
        options = previewOptions;
        const login = await context.request.post("/__fixtures/session", { data: { messages } });
        expect(login.status()).toBe(204);
        expect((await (await context.request.get("/api/auth/session")).json()).authenticated).toBe(true);
        await page.goto(route);
        await expect(page.getByRole("button", { name: "Edit message", exact: true })).toBeVisible();
        await expect(page).not.toHaveURL(/\/login/);
      },
    });
    expect(errors, "uncaught browser errors").toEqual([]);
    expect(unexpected, "unstubbed external/API requests").toEqual([]);
  },
});

export async function screenshot(page: Page, info: TestInfo, state: string) {
  const path = info.outputPath(`${state}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await info.attach(state, { path, contentType: "image/png" });
}
export { expect };
