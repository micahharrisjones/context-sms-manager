import { expect, test, type Page, type Route } from "@playwright/test";
import type { LibraryScanStatus } from "../../../shared/knowledge";

// This spec also runs under the preview config; requests use a fixed local zone.
test.use({ timezoneId: "America/Los_Angeles" });

interface ApiResult {
  status?: number;
  body: unknown;
}

interface KnowledgeFixture {
  searches: URL[];
  scopeRequests: number;
  preferenceWrites: Array<{ enabled: boolean; photoEnabled: boolean }>;
  backfills: Array<{ dryRun: boolean; confirm?: boolean; limit: number }>;
  retries: number[];
  preferences: {
    enabled: boolean;
    photoEnabled: boolean;
    available: boolean;
    disclosure: string;
    limits: { savesPerDay: number; photosPerDay: number; searchesPerDay: number; linksPerSave: number; backfillBatch: number };
  };
  details: Record<number, {
    messageId: number;
    status: "not_indexed" | "queued" | "processing" | "ready" | "partial" | "blocked" | "unsupported" | "failed" | "paused";
    sources: Array<{
      id: string;
      kind: "note" | "page" | "photo" | "preview";
      title: string;
      url?: string;
      text: string;
      observations: string;
      status: "not_indexed" | "queued" | "processing" | "ready" | "partial" | "blocked" | "unsupported" | "failed" | "paused";
      reason?: string;
      retrievedAt: string;
      truncated?: boolean;
    }>;
    canRetry: boolean;
    errorCode?: string | null;
  }>;
  searchHandler: (url: URL) => Promise<ApiResult>;
  backfillHandler?: (data: { dryRun: boolean; confirm?: boolean; limit: number }) => Promise<ApiResult>;
}

function message(id: number) {
  return {
    id,
    content: `A saved note for fixture item ${id}`,
    timestamp: "2025-02-14T16:32:00.000Z",
    senderId: "user-900007",
    tags: [],
  };
}

function searchResponse(url: URL, summary = "A useful answer from your saved sources.") {
  const boardId = url.searchParams.get("boardId");
  return {
    messages: [message(71)],
    query: url.searchParams.get("q") || "",
    aiSummary: summary,
    answerStatus: "ready",
    citations: [{
      id: "citation-71",
      messageId: 71,
      sourceId: "page-71",
      title: "Fixture source about garden herbs",
      url: "https://example.test/herbs",
      excerpt: "The saved page recommends keeping basil in bright indirect light.",
      kind: "page",
      coverage: "ready",
    }],
    searchMethod: "hybrid",
    filters: { ...(boardId ? { boardId: Number(boardId) } : {}), tags: [] as string[] },
    warnings: [],
    coverage: { total: 3, ready: 2, partial: 1, pending: 0, failed: 0, unindexed: 0 },
  };
}

function createFixture(): KnowledgeFixture {
  const now = "2025-02-14T16:32:00.000Z";
  return {
    searches: [],
    scopeRequests: 0,
    preferenceWrites: [],
    backfills: [],
    retries: [],
    preferences: {
      enabled: true,
      photoEnabled: false,
      available: true,
      disclosure: "Fixture disclosure.",
      limits: { savesPerDay: 100, photosPerDay: 20, searchesPerDay: 50, linksPerSave: 5, backfillBatch: 20 },
    },
    details: {
      71: {
        messageId: 71,
        status: "ready",
        canRetry: true,
        sources: [{
          id: "page-71",
          kind: "page",
          title: "Herb growing guide",
          url: "https://example.test/herbs",
          text: "Basil prefers bright, indirect light and evenly moist soil.",
          observations: "This save is about caring for basil indoors.",
          status: "ready",
          retrievedAt: now,
        }],
      },
      73: {
        messageId: 73,
        status: "failed",
        canRetry: false,
        sources: [],
        errorCode: "permission_denied",
      },
    },
    searchHandler: async (url) => ({ body: searchResponse(url) }),
  };
}

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installApiFixtures(page: Page, fixture: KnowledgeFixture) {
  await page.addInitScript(() => localStorage.setItem("pwa-install-dismissed", Date.now().toString()));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/knowledge/library-scan" && request.method() === "GET") {
      await fulfill(route, { status: "dismissed", total: 0, processed: 0, indexed: 0, partial: 0, notIndexed: 0, reasons: [],
        available: true, photoEnabled: false, analysisEnabled: true });
      return;
    }
    if (path === "/api/auth/session" && request.method() === "GET") {
      await fulfill(route, { authenticated: true, userId: 900007 });
      return;
    }
    if (path === "/api/profile" && request.method() === "GET") {
      await fulfill(route, {
        id: 900007,
        firstName: "Fixture",
        lastName: "Tester",
        displayName: "Fixture Tester",
        phoneNumber: "TEST_ONLY",
      });
      return;
    }
    if (path === "/api/knowledge/settings" && request.method() === "GET") {
      await fulfill(route, fixture.preferences);
      return;
    }
    if (path === "/api/knowledge/settings" && request.method() === "PUT") {
      const data = request.postDataJSON() as { enabled: boolean; photoEnabled: boolean };
      fixture.preferenceWrites.push(data);
      fixture.preferences = { ...fixture.preferences, ...data };
      await fulfill(route, fixture.preferences);
      return;
    }
    if (path === "/api/knowledge/scopes" && request.method() === "GET") {
      fixture.scopeRequests++;
      await fulfill(route, {
        boards: [
          { id: 17, name: "Shared archive", ambiguous: false },
          { id: 18, name: "Ambiguous collection", ambiguous: true },
        ],
      });
      return;
    }
    if (path === "/api/ai-search" && request.method() === "GET") {
      fixture.searches.push(url);
      const result = await fixture.searchHandler(url);
      try {
        await fulfill(route, result.body, result.status ?? 200);
      } catch {
        // Superseded searches are deliberately aborted by the UI.
      }
      return;
    }
    if (path === "/api/knowledge/backfill" && request.method() === "POST") {
      const data = request.postDataJSON() as { dryRun: boolean; confirm?: boolean; limit: number };
      fixture.backfills.push(data);
      if (fixture.backfillHandler) {
        const result = await fixture.backfillHandler(data);
        try {
          await fulfill(route, result.body, result.status ?? 200);
        } catch {
          // Navigating away deliberately aborts the request.
        }
        return;
      }
      await fulfill(route, data.dryRun
        ? { count: 7, limit: data.limit, estimatedPassagesUpperBound: 42 }
        : { queued: 7 });
      return;
    }
    const detailMatch = path.match(/^\/api\/knowledge\/items\/(\d+)$/);
    if (detailMatch && request.method() === "GET") {
      const id = Number(detailMatch[1]);
      await fulfill(route, fixture.details[id] ?? {
        messageId: id,
        status: "not_indexed",
        canRetry: false,
        sources: [],
      });
      return;
    }
    const retryMatch = path.match(/^\/api\/knowledge\/items\/(\d+)\/retry$/);
    if (retryMatch && request.method() === "POST") {
      fixture.retries.push(Number(retryMatch[1]));
      await fulfill(route, { queued: true });
      return;
    }

    // Fail closed on unplanned calls instead of allowing a browser test to touch backend data.
    await fulfill(route, { error: `Unexpected API request: ${request.method()} ${path}` }, 501);
  });
}

async function openSearch(page: Page, fixture = createFixture()) {
  await installApiFixtures(page, fixture);
  await page.goto("/search");
  await expect(page.getByLabel("Search your saved links, photos and notes")).toBeVisible();
  await expect(page.getByLabel("Include photos")).toBeVisible();
  await expect(page.getByLabel("Include photos")).toHaveAccessibleDescription("Allow OpenAI to analyze saved photos. This preference applies across your library, not just this search.");
  await expect(page.getByRole("heading", { name: "Your library, understood" })).toHaveCount(0);
  return fixture;
}

async function installScanFixture(page: Page, initial: Partial<LibraryScanStatus> = {}) {
  const fixture = createFixture();
  fixture.preferences.enabled = initial.analysisEnabled ?? true;
  fixture.preferences.photoEnabled = initial.photoEnabled ?? false;
  await installApiFixtures(page, fixture);
  const control = {
    status: { status: "intro", total: 3, processed: 0, indexed: 0, partial: 0, notIndexed: 0,
      reasons: [], available: true, photoEnabled: false, analysisEnabled: true, ...initial } as LibraryScanStatus,
    starts: 0, dismissals: 0, failStart: false, failDismiss: false, failPoll: false,
  };
  await page.route("**/api/knowledge/library-scan**", async route => {
    if (route.request().url().endsWith("/dismiss")) {
      control.dismissals++;
      if (control.failDismiss) return fulfill(route, { error: "synthetic failure" }, 503);
      control.status = { ...control.status, status: "dismissed" };
      return fulfill(route, { dismissed: true });
    }
    if (route.request().method() === "POST") {
      control.starts++;
      expect(route.request().postDataJSON()).toEqual({ confirm: true });
      if (control.failStart) return fulfill(route, { error: "synthetic failure" }, 503);
      fixture.preferences.enabled = true;
      control.status = { ...control.status, status: control.status.total === 0 ? "completed" : "running", analysisEnabled: true };
    } else if (control.failPoll) {
      return fulfill(route, { error: "synthetic status failure" }, 503);
    }
    return fulfill(route, control.status);
  });
  return { control, fixture };
}

test("search upgrade can be deferred for the current login without starting AI work", async ({ page }) => {
  const { control } = await installScanFixture(page);
  await page.goto("/search");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("more robust AI");
  await expect(dialog).toContainText("AI usage charges");
  await expect(dialog).toContainText("this scan does not change your photo choice");
  const later = dialog.getByRole("button", { name: "let's do this next time", exact: true });
  expect(await later.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.screenshot({ path: "/tmp/aside-scan-intro.jpg", fullPage: true });
  await dialog.getByRole("button", { name: "let's do this next time", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Include photos")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(control.starts).toBe(0);
  expect(control.dismissals).toBe(0);
});

test("older-save scan shows real progress then counts, reasons and a working search action", async ({ page }) => {
  const { control } = await installScanFixture(page, { analysisEnabled: false });
  await page.goto("/profile");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("will enable AI analysis");
  await dialog.getByRole("button", { name: "Scan and index older saves", exact: true }).click();
  const progress = dialog.getByRole("progressbar");
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await expect(dialog.getByRole("button", { name: "try searching now" })).toHaveCount(0);
  control.status = { ...control.status, processed: 1, indexed: 1 };
  await expect(progress).toHaveAttribute("aria-valuenow", "1", { timeout: 8000 });
  await page.screenshot({ path: "/tmp/aside-scan-progress.jpg", fullPage: true });
  control.status = { ...control.status, status: "completed", processed: 3, indexed: 2, partial: 1, notIndexed: 1,
    reasons: [{ reason: "Private, paywalled or blocked link could not be read", count: 1 }] };
  await expect(dialog.getByRole("button", { name: "try searching now" })).toBeVisible({ timeout: 8000 });
  await expect(dialog).toContainText("including 1 partial save");
  await expect(dialog).toContainText("Private, paywalled or blocked link could not be read");
  expect(await dialog.getByRole("button", { name: "I'll try it later", exact: true }).evaluate(el => el.getBoundingClientRect().bottom))
    .toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.screenshot({ path: "/tmp/aside-scan-complete.jpg", fullPage: true });
  await dialog.getByRole("button", { name: "try searching now", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(dialog).toHaveCount(0);
  expect(control.starts).toBe(1);
  expect(control.dismissals).toBe(1);
});

test("a minimized scan survives reload and completion can be acknowledged for later", async ({ page }) => {
  const { control } = await installScanFixture(page, { status: "running", processed: 1, indexed: 1 });
  await page.goto("/search");
  await page.getByRole("button", { name: "Close for now", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  control.status = { ...control.status, status: "completed", processed: 3, indexed: 3 };
  await page.getByRole("button", { name: "I'll try it later", exact: true }).click({ timeout: 8000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Include photos")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(control.starts).toBe(0);
});

test("failed scan starts and failed completion acknowledgements stay honest and retryable", async ({ page }) => {
  const { control } = await installScanFixture(page);
  control.failStart = true;
  await page.goto("/search");
  await page.getByRole("button", { name: "Scan and index older saves", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("couldn't confirm");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  control.failStart = false;
  await page.getByRole("button", { name: "Scan and index older saves", exact: true }).click();
  control.status = { ...control.status, status: "completed", processed: 3, indexed: 3 };
  control.failDismiss = true;
  await page.getByRole("button", { name: "I'll try it later", exact: true }).click({ timeout: 8000 });
  await expect(page.getByRole("alert")).toContainText("couldn't save");
  await expect(page.getByRole("dialog")).toBeVisible();
  control.failDismiss = false;
  await page.getByRole("button", { name: "I'll try it later", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("empty libraries complete with zero indexed cards; unavailable providers never start", async ({ page }) => {
  const { control } = await installScanFixture(page, { total: 0 });
  await page.goto("/search");
  await page.getByRole("button", { name: "Scan and index older saves", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("of 0 total saves");
  await page.getByRole("button", { name: "I'll try it later", exact: true }).click();
  await page.evaluate(() => sessionStorage.clear());
  control.status = { ...control.status, status: "intro", total: 3, available: false };
  await page.reload();
  await expect(page.getByRole("button", { name: "Scan and index older saves", exact: true })).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText("isn’t available right now");
  expect(control.starts).toBe(1);
});

async function runQuery(page: Page, query: string) {
  const input = page.getByLabel("Search your saved links, photos and notes");
  await input.fill(query);
  await page.locator('form button[type="submit"]').click();
}

// Backfill remains available as a retained component, but is deliberately absent
// from the search page. Mount it only in isolated component tests below.
async function mountBackfillFixture(page: Page) {
  await page.evaluate(async () => {
    const componentPath = "/src/components/knowledge/KnowledgeBackfill.tsx";
    const [componentCode, mainCode] = await Promise.all([
      fetch(componentPath).then(r => r.text()), fetch("/src/main.tsx").then(r => r.text()),
    ]);
    const reactPath = componentCode.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/)?.[1];
    const rootPath = mainCode.match(/from\s+["']([^"']*\/react-dom_client\.js[^"']*)["']/)?.[1];
    if (!reactPath || !rootPath) throw new Error("Could not locate the app's shared React modules for the retained-component fixture.");
    const [react, dom, component] = await Promise.all([import(reactPath), import(rootPath), import(componentPath)]);
    const container = document.createElement("div");
    container.id = "retained-backfill-fixture";
    Object.assign(container.style, {
      position: "fixed", inset: "16px", zIndex: "10000",
      overflowY: "auto", background: "#fffdf9", padding: "16px",
    });
    document.body.append(container);
    const root = (dom.default ?? dom).createRoot(container);
    (window as typeof window & { backfillFixtureRoot: { unmount(): void } }).backfillFixtureRoot = root;
    root.render((react.default ?? react).createElement(component.KnowledgeBackfill));
  });
  await expect(page.getByRole("button", { name: "Estimate a batch" })).toBeVisible();
}

test("simplified search waits for submission and does not request hidden scopes, dates or backfills", async ({ page }) => {
  const fixture = await openSearch(page);
  const input = page.getByLabel("Search your saved links, photos and notes");
  await expect(page.getByLabel("Search scope")).toHaveCount(0);
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await expect(page.getByLabel("Enable answers from saved content")).toHaveCount(0);
  await expect(page.getByText("Fixture disclosure.")).toHaveCount(0);
  await expect(page.getByText(/Page text from your saves is sent to OpenAI/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Bring older saves into your library" })).toHaveCount(0);
  await expect(page.getByLabel("Include photos")).toBeVisible();
  await expect(page.getByText("Private, paywalled and blocked pages may not be readable.", { exact: true })).toBeVisible();
  await expect(page.locator("form #search-reading-limit")).toHaveText("Private, paywalled and blocked pages may not be readable.");
  await expect(input).toHaveAttribute("aria-describedby", "search-reading-limit");
  await expect(page.getByText(/Search runs only when you submit|Up to 800 characters/)).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Photo preferences" }).getByText(/Private, paywalled/)).toHaveCount(0);
  await expect(page.locator("form").getByLabel("Include photos")).toBeVisible();
  const photoGroup = page.getByRole("group", { name: "Photo preferences" });
  expect(await photoGroup.evaluate(element => {
    const styles = getComputedStyle(element);
    return styles.borderTopWidth === "0px" && styles.backgroundColor === "rgba(0, 0, 0, 0)";
  })).toBe(true);

  await input.fill("basil");
  await page.waitForTimeout(850);
  expect(fixture.searches).toHaveLength(0);

  await page.locator('form button[type="submit"]').click();
  await expect(page.locator("#save-71")).toBeVisible();
  await expect(page.getByTestId("knowledge-answer")).toHaveCount(0);
  await expect(page.getByText("From your saves", { exact: true })).toHaveCount(0);
  await expect(page.getByText("2 ready", { exact: true })).toHaveCount(0);
  await expect(page.getByText("1 partial", { exact: true })).toHaveCount(0);
  await expect.poll(() => fixture.searches.length).toBe(1);

  const sent = fixture.searches[0];
  expect(sent.searchParams.get("q")).toBe("basil");
  expect(sent.searchParams.has("boardId")).toBe(false);
  expect(sent.searchParams.has("from")).toBe(false);
  expect(sent.searchParams.has("to")).toBe(false);
  expect(sent.searchParams.get("tz")).toBe("America/Los_Angeles");

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator("#save-71")).toHaveCount(0);
  await expect(page.getByText("Fixture source about garden herbs")).toHaveCount(0);
  await input.fill("basil in my saves");
  await input.press("Enter");
  await expect(page.locator("#save-71")).toBeVisible();
  await expect.poll(() => fixture.searches.length).toBe(2);
  expect(fixture.searches[1].searchParams.has("boardId")).toBe(false);
  expect(fixture.searches[1].searchParams.has("from")).toBe(false);
  expect(fixture.scopeRequests).toBe(0);
  expect(fixture.backfills).toEqual([]);
});

test("citations jump to the displayed save without exposing indexing controls", async ({ page }) => {
  const fixture = await openSearch(page);
  await runQuery(page, "basil");

  const citation = page.getByRole("link", { name: /Fixture source about garden herbs/ });
  await expect(citation).toBeVisible();
  await citation.click();
  await expect(page.locator("#save-71")).toBeVisible();
  await expect(page).toHaveURL(/#save-71$/);

  await expect(page.getByRole("button", { name: /Library coverage|Retry analysis/ })).toHaveCount(0);
  await expect(page.getByText("Source text", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Interpretations", { exact: true })).toHaveCount(0);
  expect(fixture.retries).toEqual([]);
});

test("a denied search removes previous saves and citations", async ({ page }) => {
  const fixture = createFixture();
  fixture.searchHandler = async (url) => {
    if (url.searchParams.get("q") === "denied private archive") {
      return { status: 403, body: { error: "forbidden" } };
    }
    return { body: searchResponse(url, "Earlier answer from this scope.") };
  };
  await openSearch(page, fixture);

  await runQuery(page, "saved in this archive");
  await expect(page.locator("#save-71")).toBeVisible();

  const input = page.getByLabel("Search your saved links, photos and notes");
  await input.fill("denied private archive");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText("Search couldn't finish")).toBeVisible();
  await expect(page.getByText("Earlier answer from this scope.")).toHaveCount(0);
  await expect(page.locator("#save-71")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Fixture source about garden herbs/ })).toHaveCount(0);
  expect(fixture.searches.at(-1)?.searchParams.has("boardId")).toBe(false);
});

test("an older delayed response cannot overwrite the newest submitted query", async ({ page }) => {
  await installAnalytics(page, "record", true);
  const fixture = createFixture();
  fixture.searchHandler = async (url) => {
    const query = url.searchParams.get("q");
    if (query === "slow question") {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return { body: { ...searchResponse(url), messages: [{ ...message(71), content: "Stale save for slow question." }] } };
    }
    return { body: { ...searchResponse(url), messages: [{ ...message(71), content: "Current save for latest question." }] } };
  };
  await openSearch(page, fixture);

  const input = page.getByLabel("Search your saved links, photos and notes");
  await input.fill("slow question");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => fixture.searches.length).toBe(1);
  await expect(page.getByRole("button", { name: "Search again", exact: true })).toBeVisible();

  await input.fill("latest question");
  await page.getByRole("button", { name: "Search again", exact: true }).click();
  await expect(page.getByText("Current save for latest question.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
  await page.waitForTimeout(850);
  await expect(page.getByText("Current save for latest question.")).toBeVisible();
  await expect(page.getByText("Stale save for slow question.")).toHaveCount(0);
  expect(await knowledgeEvents(page)).toEqual([{
    name: "knowledge_search_completed",
    data: { answer_status: "ready", search_method: "hybrid", result_count: 1, citation_count: 1 },
  }]);
});

type AnalyticsMode = "record" | "absent" | "throw" | "reject";
type CapturedEvent = { name: string; data?: Record<string, string | number | boolean> };

async function installAnalytics(page: Page, mode: AnalyticsMode = "record", ignoreAbort = false) {
  await page.addInitScript(({ mode, ignoreAbort }) => {
    const browser = window as typeof window & { capturedEvents: CapturedEvent[] };
    browser.capturedEvents = [];
    if (mode !== "absent") {
      window.umami = {
        track(name, data) {
          browser.capturedEvents.push({ name, data });
          if (mode === "throw") throw new Error("test tracker failure");
          if (mode === "reject") return Promise.reject(new Error("test tracker rejection"));
        },
      };
    }
    // Simulate a transport ignoring cancellation to exercise stale/unmounted guards.
    if (ignoreAbort) {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = String(input);
        return originalFetch(input, url.includes("/api/ai-search") || url.includes("/api/knowledge/backfill")
          ? { ...init, signal: undefined } : init);
      };
    }
  }, { mode, ignoreAbort });
}

async function knowledgeEvents(page: Page): Promise<CapturedEvent[]> {
  return page.evaluate(() => (window as typeof window & { capturedEvents: CapturedEvent[] })
    .capturedEvents.filter((event) => event.name.startsWith("knowledge_")));
}

for (const status of ["ready", "insufficient", "unavailable", "disabled"] as const) {
  test(`analytics records the accepted ${status} outcome once, not typing or rerenders`, async ({ page }) => {
    await installAnalytics(page);
    const fixture = createFixture();
    fixture.searchHandler = async (url) => ({
      body: {
        ...searchResponse(url),
        answerStatus: status,
        searchMethod: status === "ready" ? "hybrid" : "keyword",
        aiSummary: status === "ready" ? "Accepted answer." : null,
        messages: status === "ready" ? [message(71)] : [],
        citations: status === "ready" ? searchResponse(url).citations : [],
      },
    });
    await openSearch(page, fixture);
    await page.getByLabel("Search your saved links, photos and notes").fill("private query #private-tag");
    expect(await knowledgeEvents(page)).toEqual([]);
    await page.locator('form button[type="submit"]').click();
    const expected = [{
      name: "knowledge_search_completed",
      data: { answer_status: status, search_method: status === "ready" ? "hybrid" : "keyword",
        result_count: status === "ready" ? 1 : 0, citation_count: status === "ready" ? 1 : 0 },
    }];
    await expect.poll(() => knowledgeEvents(page)).toEqual(expected);
    await page.getByLabel("Search your saved links, photos and notes").fill("another private draft");
    expect(await knowledgeEvents(page)).toEqual(expected);
  });
}

for (const kind of ["note", "page", "photo", "preview"] as const) {
  test(`cited ${kind} inspection sends only the kind, once per citation per accepted search`, async ({ page }) => {
    await installAnalytics(page);
    const fixture = createFixture();
    fixture.searchHandler = async (url) => {
      const body = searchResponse(url);
      body.citations[0].kind = kind;
      body.citations[0].url = "https://private.test/photo?signature=secret";
      return { body };
    };
    await openSearch(page, fixture);
    await runQuery(page, "private query");
    const citation = page.getByRole("link", { name: /Fixture source about garden herbs/ });
    await citation.click();
    await citation.click();
    await expect(page.getByRole("button", { name: /Library coverage/ })).toHaveCount(0);
    const inspections = () => knowledgeEvents(page).then((events) => events.filter((event) => event.name === "knowledge_cited_source_inspected"));
    expect(await inspections()).toEqual([{ name: "knowledge_cited_source_inspected", data: { source_kind: kind } }]);
    await runQuery(page, "another search");
    await citation.click();
    expect(await inspections()).toHaveLength(2);
  });
}

for (const cancel of ["clear", "preferences", "unmount"] as const) {
  test(`a delayed search after ${cancel} sends no success even if the transport ignores abort`, async ({ page }) => {
    await installAnalytics(page, "record", true);
    const fixture = createFixture();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    fixture.searchHandler = async (url) => {
      await pending;
      return { body: searchResponse(url) };
    };
    await openSearch(page, fixture);
    await runQuery(page, "delayed private query");
    await expect.poll(() => fixture.searches.length).toBe(1);
    if (cancel === "clear") await page.getByRole("button", { name: "Clear search" }).click();
    if (cancel === "preferences") {
      await page.getByLabel("Include photos").check();
      await expect.poll(() => fixture.preferenceWrites.length).toBe(1);
    }
    if (cancel === "unmount") await page.locator('[data-pendo="bottom-tab-profile"]').click();
    release();
    await page.waitForTimeout(300);
    expect(await knowledgeEvents(page)).toEqual([]);
    await expect(page.getByTestId("knowledge-answer")).toHaveCount(0);
  });
}

test("failed searches and failed confirmed batches are not successes; only accepted queueing counts", async ({ page }) => {
  await installAnalytics(page);
  const fixture = createFixture();
  fixture.searchHandler = async () => ({ status: 503, body: { error: "private provider error" } });
  let failBatch = true;
  fixture.backfillHandler = async (data) => data.dryRun
    ? { body: { count: 7, limit: 20, estimatedPassagesUpperBound: 42 } }
    : failBatch ? { status: 503, body: { error: "private provider error" } } : { body: { queued: 7 } };
  await openSearch(page, fixture);
  await runQuery(page, "failed query");
  await expect(page.getByText("Search couldn't finish")).toBeVisible();
  await mountBackfillFixture(page);
  await page.getByRole("button", { name: "Estimate a batch" }).click();
  await page.getByRole("button", { name: "Review and confirm batch" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await knowledgeEvents(page)).toEqual([]);
  await page.getByRole("button", { name: "Review and confirm batch" }).click();
  await page.getByRole("button", { name: "Yes, queue batch" }).click();
  await expect(page.getByText(/The batch couldn't be queued/)).toBeVisible();
  expect(await knowledgeEvents(page)).toEqual([]);
  failBatch = false;
  await page.getByRole("button", { name: "Yes, queue batch" }).click();
  await expect(page.getByText("7 saves were queued for processing.")).toBeVisible();
  expect(await knowledgeEvents(page)).toEqual([{ name: "knowledge_older_saves_queued", data: { queued_count: 7 } }]);
  await page.getByRole("button", { name: "Estimate a batch" }).click();
  await page.getByRole("button", { name: "Review and confirm batch" }).click();
  expect(await knowledgeEvents(page)).toHaveLength(1);
});

test("a confirmed batch is locked while pending and does not emit after unmount", async ({ page }) => {
  await installAnalytics(page, "record", true);
  const fixture = createFixture();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  fixture.backfillHandler = async (data) => {
    if (data.dryRun) return { body: { count: 7, limit: 20, estimatedPassagesUpperBound: 42 } };
    await pending;
    return { body: { queued: 7 } };
  };
  await openSearch(page, fixture);
  await mountBackfillFixture(page);
  await page.getByRole("button", { name: "Estimate a batch" }).click();
  await page.getByRole("button", { name: "Review and confirm batch" }).click();
  await page.getByRole("button", { name: "Yes, queue batch" }).evaluate((element: HTMLButtonElement) => {
    element.click();
    element.click();
  });
  await expect.poll(() => fixture.backfills.length).toBe(2);
  await expect(page.getByRole("button", { name: "Queueing…" })).toBeDisabled();
  await page.evaluate(() => {
    (window as typeof window & { backfillFixtureRoot: { unmount(): void } }).backfillFixtureRoot.unmount();
    document.getElementById("retained-backfill-fixture")?.remove();
  });
  await page.locator('[data-pendo="bottom-tab-profile"]').click();
  release();
  await page.waitForTimeout(300);
  expect(fixture.backfills).toHaveLength(2);
  expect(await knowledgeEvents(page)).toEqual([]);
});

for (const mode of ["absent", "throw", "reject"] as const) {
  test(`search, citation navigation and batch confirmation work with ${mode} analytics`, async ({ page }) => {
    const errors: string[] = [];
    await installAnalytics(page, mode);
    await openSearch(page);
    // Measure interaction errors, not the existing local Vite HMR startup failure.
    page.on("pageerror", (error) => errors.push(error.message));
    await runQuery(page, "basil");
    await expect(page.locator("#save-71")).toBeVisible();
    await page.getByRole("link", { name: /Fixture source about garden herbs/ }).click();
    await expect(page).toHaveURL(/#save-71$/);
    await mountBackfillFixture(page);
    await page.getByRole("button", { name: "Estimate a batch" }).click();
    await page.getByRole("button", { name: "Review and confirm batch" }).click();
    await page.getByRole("button", { name: "Yes, queue batch" }).click();
    await expect(page.getByText("7 saves were queued for processing.")).toBeVisible();
    expect(await knowledgeEvents(page)).toHaveLength(mode === "absent" ? 0 : 3);
    expect(errors).toEqual([]);
  });
}

test("mounted mobile analytics caps oversized citation and queue counts", async ({ page }) => {
  await installAnalytics(page);
  const fixture = createFixture();
  fixture.searchHandler = async (url) => {
    const body = searchResponse(url);
    body.citations = Array.from({ length: 101 }, (_, index) => ({ ...body.citations[0], id: `citation-${index}` }));
    return { body };
  };
  fixture.backfillHandler = async (data) => ({
    body: data.dryRun ? { count: 20, limit: 20, estimatedPassagesUpperBound: 120 } : { queued: 200 },
  });
  await openSearch(page, fixture);
  await runQuery(page, "private query");
  await expect(page.locator("#save-71")).toBeVisible();
  await mountBackfillFixture(page);
  await page.getByRole("button", { name: "Estimate a batch" }).click();
  await page.getByRole("button", { name: "Review and confirm batch" }).click();
  await page.getByRole("button", { name: "Yes, queue batch" }).click();
  await expect(page.getByText("200 saves were queued for processing.")).toBeVisible();
  expect(await knowledgeEvents(page)).toEqual([
    { name: "knowledge_search_completed", data: { answer_status: "ready", search_method: "hybrid", result_count: 1, citation_count: 100 } },
    { name: "knowledge_older_saves_queued", data: { queued_count: 20 } },
  ]);
});

for (const state of ["insufficient", "unavailable"] as const) {
  test(`${state} answer states do not render a fabricated AI summary`, async ({ page }) => {
    const fixture = createFixture();
    const warning = "Some saves have incomplete or unavailable source content. Answers can only use the evidence retrieved.";
    fixture.searchHandler = async (url) => ({
      body: {
        messages: [],
        query: url.searchParams.get("q") || "",
        aiSummary: state === "unavailable" ? "This inconsistent answer must not appear." : null,
        answerStatus: state,
        citations: [],
        searchMethod: "keyword",
        filters: { tags: [] },
        warnings: [warning],
        coverage: { total: 2, ready: 0, partial: 1, pending: 0, failed: 0, unindexed: 1 },
      },
    });
    await openSearch(page, fixture);
    await runQuery(page, `${state} query`);

    await expect(page.getByText(state === "insufficient"
      ? "There isn't enough indexed source material for a reliable answer yet. Try a different phrase."
      : "A generated answer isn't available for this search. Your saved items below are still searchable.")).toBeVisible();
    await expect(page.getByTestId("knowledge-answer")).toHaveCount(0);
    await expect(page.getByText("This inconsistent answer must not appear.")).toHaveCount(0);
    await expect(page.getByText("1 partial", { exact: true })).toHaveCount(0);
    await expect(page.getByText("No matching saves found")).toBeVisible();
    await expect(page.getByText(warning, { exact: true })).toHaveCount(1);
    if (state === "insufficient") {
      const notice = page.getByRole("note", { name: "Search content notice" });
      await expect(notice).toContainText("There isn't enough indexed source material");
      await expect(notice.getByText(warning, { exact: true })).toBeVisible();
      await page.screenshot({ path: "/tmp/aside-search-no-matches.jpg", fullPage: true });
    } else {
      await expect(page.getByRole("note", { name: "Search content notice" })).toHaveCount(0);
      await expect(page.getByText(warning, { exact: true })).toBeVisible();
    }
  });
}

test("photo preference changes preserve the existing analysis consent", async ({ page }) => {
  const fixture = await openSearch(page);
  const photos = page.getByLabel("Include photos");

  await photos.check();
  await expect.poll(() => fixture.preferenceWrites.length).toBe(1);
  expect(fixture.preferenceWrites[0]).toEqual({ enabled: true, photoEnabled: true });
  await expect(photos).toBeEnabled();
  await photos.uncheck();
  await expect.poll(() => fixture.preferenceWrites.length).toBe(2);
  expect(fixture.preferenceWrites[1]).toEqual({ enabled: true, photoEnabled: false });
  await expect(page.getByLabel("Enable answers from saved content")).toHaveCount(0);
  await expect(page.getByLabel("Search your saved links, photos and notes")).toHaveAttribute("aria-describedby", "search-reading-limit");
});

test("reloading the inline photo control never submits a draft search", async ({ page }) => {
  const fixture = createFixture();
  await installApiFixtures(page, fixture);
  let reads = 0;
  await page.route("**/api/knowledge/settings", async route => {
    if (route.request().method() === "GET" && ++reads === 1) return fulfill(route, { error: "synthetic unavailable" }, 503);
    await route.fallback();
  });
  await page.goto("/search");
  await expect(page.getByRole("alert")).toContainText("Preferences could not be loaded.");
  await page.getByLabel("Search your saved links, photos and notes").fill("basil");
  await page.getByRole("button", { name: "Reload preferences" }).click();
  await expect(page.locator("form").getByLabel("Include photos")).toBeVisible();
  expect(fixture.searches).toEqual([]);
  expect(fixture.preferenceWrites).toEqual([]);
});

test("photo opt-in does not silently reactivate paused library analysis", async ({ page }) => {
  const fixture = createFixture();
  fixture.preferences.enabled = false;
  await openSearch(page, fixture);
  await page.getByLabel("Include photos").check();
  await expect.poll(() => fixture.preferenceWrites).toEqual([{ enabled: false, photoEnabled: true }]);
  await expect(page.getByLabel("Include photos")).toBeChecked();
  await expect(page.getByText(/Library analysis is paused/)).toBeVisible();
});

test("failed photo preference updates restore the checkbox and show a safe retry error", async ({ page }) => {
  await openSearch(page);
  await page.route("**/api/knowledge/settings", async route => {
    if (route.request().method() === "PUT") return fulfill(route, { error: "private provider diagnostic" }, 503);
    await route.fallback();
  });
  // A rejected optimistic update may roll back before check()'s checked-state
  // assertion; click verifies the interaction without expecting it to persist.
  await page.getByLabel("Include photos").click();
  await expect(page.getByRole("alert")).toContainText("Your preference wasn't saved. Please try again.");
  await expect(page.getByLabel("Include photos")).not.toBeChecked();
  await expect(page.getByLabel("Include photos")).toBeEnabled();
  await expect(page.getByText("private provider diagnostic")).toHaveCount(0);
});

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1000 },
]) {
  test(`simplified search stays readable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openSearch(page);
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Include photos")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/aside-search-${viewport.name}.jpg`, fullPage: true });
    await runQuery(page, "basil");
    await expect(page.locator("#save-71")).toBeVisible();
    await expect(page.getByTestId("knowledge-answer")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/aside-search-${viewport.name}-results.jpg`, fullPage: true });
  });
}

test("provider unavailability never prevents turning off photo processing", async ({ page }) => {
  const fixture = createFixture();
  fixture.preferences = { ...fixture.preferences, available: false, enabled: true, photoEnabled: true };
  await openSearch(page, fixture);

  const photos = page.getByLabel("Include photos");
  await expect(page.getByText("Library answers aren’t currently available for this account.")).toBeVisible();
  await expect(photos).toBeEnabled();
  await photos.uncheck();
  await expect.poll(() => fixture.preferenceWrites.length).toBe(1);
  expect(fixture.preferenceWrites).toEqual([
    { enabled: true, photoEnabled: false },
  ]);
});

test("owned and shared saved-item cards omit coverage controls and make no indexing-detail requests", async ({ page }) => {
  const fixture = createFixture();
  const detailRequests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/knowledge/items/")) detailRequests.push(request.url());
  });
  fixture.searchHandler = async (url) => ({
    body: {
      ...searchResponse(url),
      messages: url.searchParams.get("q") === "shared archive save"
        ? [{ ...message(73), content: "Shared archive item" }]
        : [message(71)],
    },
  });
  await openSearch(page, fixture);
  await runQuery(page, "owner save");

  const ownerCard = page.locator("#save-71");
  await expect(ownerCard).toBeVisible();
  await expect(ownerCard.getByRole("button", { name: /Library coverage|Retry analysis/ })).toHaveCount(0);
  await expect(ownerCard.getByText(/sources found|Not in your library yet/)).toHaveCount(0);

  await runQuery(page, "shared archive save");
  const viewerCard = page.locator("#save-73");
  await expect(viewerCard).toBeVisible();
  await expect(viewerCard.getByRole("button", { name: /Library coverage|Retry analysis/ })).toHaveCount(0);
  await expect(viewerCard.getByText("Processing didn't finish")).toHaveCount(0);
  expect(fixture.retries).toEqual([]);
  expect(detailRequests).toEqual([]);
});

test("backfill dry-run makes no batch request until the user confirms the charge", async ({ page }) => {
  const fixture = await openSearch(page);
  await mountBackfillFixture(page);

  await page.getByRole("button", { name: "Estimate a batch" }).click();
  await expect(page.getByText(/This batch includes 7 saves/)).toBeVisible();
  expect(fixture.backfills).toEqual([{ dryRun: true, limit: 20 }]);

  await page.getByRole("button", { name: "Review and confirm batch" }).click();
  const confirmation = page.getByRole("group", { name: "Confirm batch processing" });
  await expect(confirmation.getByText(/may incur OpenAI charges/)).toBeVisible();
  expect(fixture.backfills.filter((request) => request.dryRun === false)).toHaveLength(0);

  await page.getByRole("button", { name: "Yes, queue batch" }).click();
  await expect(page.getByText("7 saves were queued for processing.")).toBeVisible();
  expect(fixture.backfills).toEqual([
    { dryRun: true, limit: 20 },
    { dryRun: false, confirm: true, limit: 20 },
  ]);
});
