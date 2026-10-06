import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import express from "express";
import supertest from "supertest";
import { extractPreviewUrls, storedPreviewMatches } from "../../shared/preview-urls";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", async (original) => ({ ...await original<object>(), request: mocks.request }));
vi.mock("../vite", () => ({ log: vi.fn() }));

import { isPublicAddress, resolvePublicPreviewUrl, safePreviewFetch } from "../safe-preview-fetch";
import { registerPreviewRoute } from "../preview-route";
import { UrlEnrichmentService } from "../url-enrichment-service";

type Reply = { status: number; headers?: Record<string, string>; body?: string | Buffer };
function replies(...responses: Reply[]) {
  mocks.request.mockImplementation((_url, _options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end(): void; destroy(error?: Error): void };
    req.destroy = (error) => { if (error) req.emit("error", error); req.emit("close"); };
    req.end = () => queueMicrotask(() => {
      const reply = responses.shift();
      if (!reply) return req.destroy(new Error("Unexpected extra fetch"));
      const response = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> };
      response.statusCode = reply.status;
      response.headers = reply.headers || {};
      response.on("close", () => req.emit("close"));
      callback(response);
      response.end(reply.body || "");
    });
    return req;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

describe("public-only preview transport", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "198.18.0.1", "192.0.2.1",
    "::1", "::", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "2001:db8::1", "2002:7f00:1::",
  ])("rejects reserved address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"])("accepts public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
  it.each(["file:///etc/passwd", "ftp://example.org/a", "http://user:pass@example.org", "http://example.org:8080"])(
    "rejects disallowed URL %s", async (url) => {
      await expect(resolvePublicPreviewUrl(url)).rejects.toThrow();
    },
  );
  it("rejects obfuscated loopback and IPv4-mapped IPv6", async () => {
    for (const url of ["http://2130706433", "http://0x7f000001", "http://[::ffff:127.0.0.1]"]) {
      await expect(safePreviewFetch(url)).rejects.toThrow();
    }
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("rejects hostnames resolving to a mixture of public and private addresses", async () => {
    mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    await expect(safePreviewFetch("https://example.org")).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("pins the socket lookup to the verified address", async () => {
    replies({ status: 200, body: "safe" });
    expect(await (await safePreviewFetch("https://example.org")).text()).toBe("safe");
    const options = mocks.request.mock.calls[0][1];
    const callback = vi.fn();
    options.lookup("example.org", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });
  it("blocks redirect hops to metadata services before connecting", async () => {
    replies({ status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } });
    await expect(safePreviewFetch("https://example.org")).rejects.toThrow();
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("drops credentials on cross-origin redirects", async () => {
    replies(
      { status: 302, headers: { location: "https://other.example.org/page" } },
      { status: 200, body: "ok" },
    );
    await safePreviewFetch("https://example.org", { headers: { "x-api-key": "synthetic-test-value" } });
    expect(mocks.request.mock.calls[1][1].headers["x-api-key"]).toBeUndefined();
  });
  it("bounds redirects and response size", async () => {
    replies(...Array.from({ length: 5 }, () => ({ status: 302, headers: { location: "/next" } })));
    await expect(safePreviewFetch("https://example.org")).rejects.toThrow("redirects");
    replies({ status: 200, body: Buffer.alloc(2 * 1024 * 1024 + 1) });
    await expect(safePreviewFetch("https://example.org")).rejects.toThrow("2 MB");
  });
});

describe("preview endpoint", () => {
  function app() {
    const application = express();
    const provider = { shouldFetchOpenGraph: vi.fn(() => true), fetchOpenGraph: vi.fn(async () => ({ title: "Article" })) };
    registerPreviewRoute(application, (req, res, next) => {
      if (!req.headers["x-test-user"]) return res.status(401).json({ error: "Sign in" });
      req.userId = Number(req.headers["x-test-user"]);
      next();
    }, provider);
    return { application, provider };
  }
  it("requires authentication before invoking a provider", async () => {
    const { application, provider } = app();
    expect((await supertest(application).get("/api/og-preview").query({ url: "https://example.org" })).status).toBe(401);
    expect(provider.fetchOpenGraph).not.toHaveBeenCalled();
  });
  it("rejects private destinations for authenticated users", async () => {
    const { application, provider } = app();
    expect((await supertest(application).get("/api/og-preview").set("x-test-user", "1").query({ url: "http://127.0.0.1" })).status).toBe(400);
    expect(provider.fetchOpenGraph).not.toHaveBeenCalled();
  });
  it("limits each account without blocking another account", async () => {
    const { application } = app();
    for (let i = 0; i < 30; i++) {
      expect((await supertest(application).get("/api/og-preview").set("x-test-user", "1").query({ url: "https://example.org" })).status).toBe(200);
    }
    expect((await supertest(application).get("/api/og-preview").set("x-test-user", "1").query({ url: "https://example.org" })).status).toBe(429);
    expect((await supertest(application).get("/api/og-preview").set("x-test-user", "2").query({ url: "https://example.org" })).status).toBe(200);
  });
});

describe("URL-to-metadata association", () => {
  it("normalizes punctuation and retains balanced parentheses", () => {
    expect(extractPreviewUrls("See (https://example.org/story). https://example.org/a_(b).")).toEqual([
      "https://example.org/story", "https://example.org/a_(b)",
    ]);
  });
  it("never assigns first-link metadata to a second link or trusts unknown legacy sources", () => {
    const [video, article] = extractPreviewUrls("https://youtube.com/watch?v=123 https://example.org/article");
    expect(storedPreviewMatches(video, article)).toBe(false);
    expect(storedPreviewMatches(null, article)).toBe(false);
    expect(storedPreviewMatches(article, article)).toBe(true);
  });
  it("preserves provider fallback and blocked flags", async () => {
    const service = new UrlEnrichmentService({
      fetchOpenGraph: async () => ({
        title: "Placeholder", description: "Fallback description", image: "https://example.org/logo.png",
        site_name: "Example", isFallback: true, isBlocked: true,
      }),
    });
    expect(await service.enrichUrl("https://example.org/article")).toMatchObject({ isFallback: true, isBlocked: true });
  });
});
