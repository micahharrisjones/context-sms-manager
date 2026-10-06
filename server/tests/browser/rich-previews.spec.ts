import { spawnSync } from "node:child_process";
import { test, expect, message, urls, screenshot } from "./fixtures";

const savedImage = "http://127.0.0.1:5017/__images/saved.svg";
const freshImage = "http://127.0.0.1:5017/__images/fresh.svg";
const image = (page: import("@playwright/test").Page, src: string) => page.locator(`img[src="${src}"]`);

test("fixture server refuses production even with opt-in", async () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "server/tests/browser/fixture-server.ts"], {
    env: { ...process.env, NODE_ENV: "production", PREVIEW_BROWSER_FIXTURES: "1" },
    encoding: "utf8", timeout: 10000,
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("requires NODE_ENV=test");
});

test("fixture server refuses test mode without explicit opt-in", async () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "server/tests/browser/fixture-server.ts"], {
    env: { ...process.env, NODE_ENV: "test", PREVIEW_BROWSER_FIXTURES: "" },
    encoding: "utf8", timeout: 10000,
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("explicit fixture opt-in");
});

test("protected feed and board require a session and fixtures stay session-local", async ({ page, context, playwright, harness }) => {
  expect((await context.request.get("/api/messages")).status()).toBe(401);
  for (const route of ["/", "/tag/shared/previews"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
  }
  await harness.open("/", [message({ content: "Only this test's fixture" })]);
  const anonymous = await playwright.request.newContext({ baseURL: "http://127.0.0.1:5017" });
  try {
    expect((await anonymous.get("/api/messages")).status()).toBe(401);
    await anonymous.post("/__fixtures/session", { data: { messages: [] } });
    expect(await (await anonymous.get("/api/messages")).json()).toEqual([]);
    expect((await (await context.request.get("/api/messages")).json())[0].content).toBe("Only this test's fixture");
  } finally {
    await anonymous.dispose();
  }
});

for (const [surface, route] of [["feed", "/"], ["board", "/tag/shared/previews"]] as const) {
  test.describe(surface, () => {
    test("keeps unattributed single-link thumbnails after mounted effects", async ({ page, harness }, info) => {
      await harness.open(route, [message({
        ogTitle: "Legacy single-link preview", ogImage: savedImage, ogSourceUrl: null,
      })]);
      await expect(image(page, savedImage)).toBeVisible();
      await expect(page.getByText("Legacy single-link preview", { exact: true })).toBeVisible();
      await expect(page.locator(`a[href="${urls.current}"]`)).toHaveCount(1);
      await page.clock.runFor(9000);
      expect(harness.requests).toEqual([]);
      await expect(image(page, savedImage)).toBeVisible();
      await screenshot(page, info, "legacy-after-effects");
    });

    for (const source of [null, urls.second]) {
      test(`rejects ${source ? "mismatched" : "unattributed"} multiple-link metadata`, async ({ page, harness }, info) => {
        await harness.open(route, [message({
          content: `${urls.current}\n${urls.second}`,
          ogTitle: "Wrong saved title", ogImage: savedImage, ogSourceUrl: source,
        })], { og: { title: "Current page preview", image: freshImage } });
        await expect(image(page, freshImage)).toBeVisible();
        await expect(image(page, savedImage)).toHaveCount(0);
        await expect(page.getByText("Wrong saved title", { exact: true })).toHaveCount(0);
        expect(harness.requests.filter(url => url.startsWith("/api/og-preview"))).toHaveLength(1);
        expect(new URL(harness.requests[0], "http://fixture").searchParams.get("url")).toBe(urls.current);
        await expect(page.locator(`a[href="${urls.second}"]`)).toHaveCount(1);
        await screenshot(page, info, "source-mismatch-after-loading");
      });
    }

    test("edited content cannot retain the previous thumbnail in a mounted card", async ({ page, harness }, info) => {
      await harness.open(route, [message({
        content: urls.old, ogTitle: "Old saved title", ogImage: savedImage, ogSourceUrl: urls.old,
      })], { og: { title: "New edited preview", image: freshImage } });
      await expect(image(page, savedImage)).toBeVisible();
      // An expando marks the actual card node, proving React did not unmount it.
      const edit = page.getByRole("button", { name: "Edit message", exact: true });
      await edit.evaluate(button => { (button as any).__mountedBeforeEdit = true; });
      await edit.click();
      await page.getByTestId("input-message-content").fill(urls.current);
      await page.getByTestId("button-update-message").click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.clock.runFor(2500); // Both feed and board refresh their query in-place.
      await expect(image(page, freshImage)).toBeVisible();
      expect(await edit.evaluate(button => (button as any).__mountedBeforeEdit)).toBe(true);
      await expect(image(page, savedImage)).toHaveCount(0);
      await expect(page.getByText("Old saved title", { exact: true })).toHaveCount(0);
      await expect(page.locator(`a[href="${urls.old}"]`)).toHaveCount(0);
      await screenshot(page, info, "edited-after-refetch");
    });

    test("Instagram fallback does not duplicate the clickable link", async ({ page, harness }, info) => {
      await harness.open(route, [message({ content: urls.instagram })], {
        og: { title: "Instagram", isFallback: true, isBlocked: true },
      });
      await expect(page.getByText("Preview unavailable", { exact: true })).toBeVisible();
      await page.clock.runFor(9000);
      await expect(page.locator(`a[href="${urls.instagram}"]`)).toHaveCount(1);
      await expect(page.locator('iframe[src*="instagram"]')).toHaveCount(0);
      await screenshot(page, info, "instagram-fallback-after-timers");
    });

    for (const tmdb of ["miss", "network"] as const) {
      test(`IMDb ${tmdb} uses independent page metadata`, async ({ page, harness }, info) => {
        await harness.open(route, [message({ content: urls.imdb })], {
          tmdb, og: { title: "Catalogue-missing fixture film", image: freshImage },
        });
        await expect(image(page, freshImage)).toBeVisible();
        await expect(page.getByText("Catalogue-missing fixture film", { exact: true })).toBeVisible();
        await expect(page.locator(`a[href="${urls.imdb}"]`)).toHaveCount(1);
        expect(harness.requests.map(url => url.split("?")[0])).toEqual([
          "/api/tmdb/movie/tt3647214", "/api/og-preview",
        ]);
        await screenshot(page, info, `imdb-${tmdb}-after-loading`);
      });
    }

    test("IMDb total provider failure keeps a link without inventing a poster", async ({ page, harness }, info) => {
      await harness.open(route, [message({ content: urls.imdb })], {
        tmdb: "network", og: { title: "Imdb", isFallback: true },
      });
      await expect.poll(() => harness.requests.length).toBe(2);
      await page.clock.runFor(9000);
      await expect(page.locator('[data-pendo="content-imdb-embed"]')).toHaveCount(0);
      await expect(page.locator(`a[href="${urls.imdb}"]`)).toHaveCount(1);
      await screenshot(page, info, "imdb-total-failure");
    });

    test("legacy IMDb saved poster survives both providers failing", async ({ page, harness }, info) => {
      await harness.open(route, [message({
        content: urls.imdb, ogTitle: "Saved fixture film", ogImage: savedImage, ogSourceUrl: null,
      })], { tmdb: "network", og: { title: "Imdb", isFallback: true } });
      await expect.poll(() => harness.requests.length).toBe(2);
      await page.clock.runFor(9000);
      await expect(image(page, savedImage)).toBeVisible();
      await expect(page.locator(`a[href="${urls.imdb}"]`)).toHaveCount(1);
      await screenshot(page, info, "saved-imdb-after-provider-failure");
    });

    for (const provider of ["reddit", "tiktok"] as const) {
      for (const embed of ["loaded", "blank", "network"] as const) {
        test(`${provider} ${embed} embed transitions to safe fallback after timeout`, async ({ page, harness }, info) => {
          await harness.open(route, [message({
            content: urls[provider], ogTitle: `${provider} saved preview`,
            ogImage: savedImage, ogSourceUrl: urls[provider],
          })], { embed });
          const iframe = page.locator(`iframe[src*="${provider}.com"]`);
          if (embed === "loaded") {
            await expect(page.frameLocator(`iframe[src*="${provider}.com"]`).getByText("Fixture embed loaded")).toBeVisible();
          } else {
            // Cross-origin blank/error frames may still fire onLoad; only the
            // elapsed-time fallback is guaranteed, not browser-specific onError.
            await expect(iframe).toHaveCount(1);
          }
          await screenshot(page, info, `embed-${embed}-before-timeout`);
          await page.clock.runFor(8100);
          await expect(iframe).toHaveCount(0);
          const fallback = page.locator(`[data-embed-type="${provider}-fallback"]`);
          await expect(fallback).toBeVisible();
          await expect(fallback).toHaveAttribute("href", urls[provider]);
          await expect(image(page, savedImage)).toBeVisible();
          await expect(page.locator(`a[href="${urls[provider]}"]`)).toHaveCount(1);
          await screenshot(page, info, `embed-${embed}-after-fallback-timer`);
        });
      }
    }
  });
}
