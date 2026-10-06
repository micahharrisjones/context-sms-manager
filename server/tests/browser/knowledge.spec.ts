import { expect, test, type Page, type Route } from "@playwright/test";

interface ApiResult {
  status?: number;
  body: unknown;
}

interface KnowledgeFixture {
  searches: URL[];
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
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

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
  await expect(page.getByRole("heading", { name: "Your library, understood" })).toBeVisible();
  return fixture;
}

async function runQuery(page: Page, query: string) {
  const input = page.getByLabel("Search your saved links, photos and notes");
  await input.fill(query);
  await page.locator('form button[type="submit"]').click();
}

test("typing waits for explicit submit; scopes and dates reach the search request and filters clear the old answer", async ({ page }) => {
  const fixture = await openSearch(page);
  const input = page.getByLabel("Search your saved links, photos and notes");

  await input.fill("basil");
  await page.waitForTimeout(850);
  expect(fixture.searches).toHaveLength(0);

  await page.getByLabel("Search scope").selectOption("17");
  await page.getByLabel("Filter from date").fill("2025-01-03");
  await page.getByLabel("Filter to date").fill("2025-02-15");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText("A useful answer from your saved sources.")).toBeVisible();
  await expect.poll(() => fixture.searches.length).toBe(1);

  const sent = fixture.searches[0];
  expect(sent.searchParams.get("q")).toBe("basil");
  expect(sent.searchParams.get("boardId")).toBe("17");
  expect(sent.searchParams.get("from")).toBe("2025-01-03");
  expect(sent.searchParams.get("to")).toBe("2025-02-15");
  expect(sent.searchParams.get("tz")).toBe("America/Los_Angeles");

  await page.getByLabel("Search scope").selectOption("");
  await expect(page.getByText("A useful answer from your saved sources.")).toHaveCount(0);
  await expect(page.getByText("Fixture source about garden herbs")).toHaveCount(0);
  await input.fill("basil in my saves");
  await input.press("Enter");
  await expect(page.getByText("A useful answer from your saved sources.")).toBeVisible();
  await expect.poll(() => fixture.searches.length).toBe(2);
  expect(fixture.searches[1].searchParams.has("boardId")).toBe(false);
  expect(fixture.searches[1].searchParams.get("from")).toBe("2025-01-03");
});

test("citations jump to the displayed save and on-demand coverage separates source text from interpretations", async ({ page }) => {
  const fixture = await openSearch(page);
  await runQuery(page, "basil");

  const citation = page.getByRole("link", { name: /Fixture source about garden herbs/ });
  await expect(citation).toBeVisible();
  await citation.click();
  await expect(page.locator("#save-71")).toBeVisible();
  await expect(page).toHaveURL(/#save-71$/);

  await page.getByRole("button", { name: /Library coverage/ }).click();
  await expect(page.getByText("Basil prefers bright, indirect light and evenly moist soil.")).toBeVisible();
  await expect(page.getByText("This save is about caring for basil indoors.")).toBeVisible();
  await expect(page.getByText("Source text", { exact: true })).toBeVisible();
  await expect(page.getByText("Interpretations", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Retry analysis" }).click();
  await expect.poll(() => fixture.retries).toEqual([71]);
});

test("a denied search in a shared scope removes the previous answer", async ({ page }) => {
  const fixture = createFixture();
  fixture.searchHandler = async (url) => {
    if (url.searchParams.get("q") === "denied private archive") {
      return { status: 403, body: { error: "forbidden" } };
    }
    return { body: searchResponse(url, "Earlier answer from this scope.") };
  };
  await openSearch(page, fixture);

  await page.getByLabel("Search scope").selectOption("17");
  await runQuery(page, "saved in this archive");
  await expect(page.getByText("Earlier answer from this scope.")).toBeVisible();

  const input = page.getByLabel("Search your saved links, photos and notes");
  await input.fill("denied private archive");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText("Search couldn't finish")).toBeVisible();
  await expect(page.getByText("Earlier answer from this scope.")).toHaveCount(0);
  expect(fixture.searches.at(-1)?.searchParams.get("boardId")).toBe("17");
});

test("an older delayed response cannot overwrite the newest submitted query", async ({ page }) => {
  const fixture = createFixture();
  fixture.searchHandler = async (url) => {
    const query = url.searchParams.get("q");
    if (query === "slow question") {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return { body: searchResponse(url, "Stale answer for slow question.") };
    }
    return { body: searchResponse(url, "Current answer for latest question.") };
  };
  await openSearch(page, fixture);

  const input = page.getByLabel("Search your saved links, photos and notes");
  await input.fill("slow question");
  await page.locator('form button[type="submit"]').click();
  await expect.poll(() => fixture.searches.length).toBe(1);

  await input.fill("latest question");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText("Current answer for latest question.")).toBeVisible();
  await page.waitForTimeout(850);
  await expect(page.getByText("Current answer for latest question.")).toBeVisible();
  await expect(page.getByText("Stale answer for slow question.")).toHaveCount(0);
});

for (const state of ["insufficient", "unavailable"] as const) {
  test(`${state} answer states do not render a fabricated AI summary`, async ({ page }) => {
    const fixture = createFixture();
    fixture.searchHandler = async (url) => ({
      body: {
        messages: [],
        query: url.searchParams.get("q") || "",
        aiSummary: state === "unavailable" ? "This inconsistent answer must not appear." : null,
        answerStatus: state,
        citations: [],
        searchMethod: "keyword",
        filters: { tags: [] },
        warnings: [],
        coverage: { total: 2, ready: 0, partial: 1, pending: 0, failed: 0, unindexed: 1 },
      },
    });
    await openSearch(page, fixture);
    await runQuery(page, `${state} query`);

    await expect(page.getByText(state === "insufficient"
      ? "There isn't enough indexed source material for a reliable answer yet. Try a different phrase or check the coverage below."
      : "A generated answer isn't available for this search. Your saved items below are still searchable.")).toBeVisible();
    await expect(page.getByTestId("knowledge-answer")).toHaveCount(0);
    await expect(page.getByText("This inconsistent answer must not appear.")).toHaveCount(0);
    await expect(page.getByText("1 partial")).toBeVisible();
    await expect(page.getByText("No matching saves found")).toBeVisible();
  });
}

test("preferences send explicit analysis and photo opt-in choices", async ({ page }) => {
  const fixture = await openSearch(page);
  const analysis = page.getByLabel("Enable answers from saved content");
  const photos = page.getByLabel("Include photos");

  await analysis.uncheck();
  await expect.poll(() => fixture.preferenceWrites.length).toBe(1);
  expect(fixture.preferenceWrites[0]).toEqual({ enabled: false, photoEnabled: false });

  await analysis.check();
  await expect.poll(() => fixture.preferenceWrites.length).toBe(2);
  await expect(photos).toBeEnabled();
  await photos.check();
  await expect.poll(() => fixture.preferenceWrites.length).toBe(3);
  expect(fixture.preferenceWrites[2]).toEqual({ enabled: true, photoEnabled: true });
  await expect(page.getByText(/Page text from your saves is sent to OpenAI/)).toBeVisible();
});

test("provider unavailability never prevents turning off analysis or photo processing", async ({ page }) => {
  const fixture = createFixture();
  fixture.preferences = { ...fixture.preferences, available: false, enabled: true, photoEnabled: true };
  await openSearch(page, fixture);

  const analysis = page.getByLabel("Enable answers from saved content");
  const photos = page.getByLabel("Include photos");
  await expect(page.getByText("Library answers aren’t currently available for this account.")).toBeVisible();
  await expect(analysis).toBeEnabled();
  await analysis.uncheck();
  await expect.poll(() => fixture.preferenceWrites.length).toBe(1);
  await expect(photos).toBeEnabled();
  await photos.uncheck();
  await expect.poll(() => fixture.preferenceWrites.length).toBe(2);
  expect(fixture.preferenceWrites).toEqual([
    { enabled: false, photoEnabled: true },
    { enabled: false, photoEnabled: false },
  ]);
});

test("owners can retry eligible saves; a shared-scope viewer cannot retry", async ({ page }) => {
  const fixture = createFixture();
  fixture.searchHandler = async (url) => ({
    body: {
      ...searchResponse(url),
      messages: url.searchParams.has("boardId")
        ? [{ ...message(73), content: "Shared archive item" }]
        : [message(71)],
    },
  });
  await openSearch(page, fixture);
  await runQuery(page, "owner save");

  const ownerCard = page.locator("#save-71");
  await ownerCard.getByRole("button", { name: /Library coverage/ }).click();
  await expect(ownerCard.getByRole("button", { name: "Retry analysis" })).toBeVisible();

  await ownerCard.getByRole("button", { name: "Retry analysis" }).click();
  await expect.poll(() => fixture.retries).toEqual([71]);

  await page.getByLabel("Search scope").selectOption("17");
  await runQuery(page, "shared archive save");
  const viewerCard = page.locator("#save-73");
  await viewerCard.getByRole("button", { name: /Library coverage/ }).click();
  await expect(viewerCard.getByText("Processing didn't finish")).toBeVisible();
  await expect(viewerCard.getByRole("button", { name: "Retry analysis" })).toHaveCount(0);
  expect(fixture.retries).not.toContain(73);
});

test("backfill dry-run makes no batch request until the user confirms the charge", async ({ page }) => {
  const fixture = await openSearch(page);

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
