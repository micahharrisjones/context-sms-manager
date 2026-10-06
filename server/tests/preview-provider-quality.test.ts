import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../safe-preview-fetch", () => ({
  resolvePublicPreviewUrl: vi.fn().mockResolvedValue({}),
  safePreviewFetch: vi.fn(),
}));
import { OpenGraphService } from "../og-service";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("provider quality and fallback order", () => {
  it("lets IMDb use page metadata when TMDB cannot resolve it", () => {
    expect(new OpenGraphService().shouldFetchOpenGraph("https://www.imdb.com/title/tt3647214/")).toBe(true);
  });
  it("tries real Instagram metadata before choosing a branded fallback", async () => {
    const service = new OpenGraphService();
    const provider = vi.spyOn(service as any, "fetchFromMicrolink").mockResolvedValue({ title: "A real Instagram post", image: "https://example.com/image.jpg" });
    expect(await service.fetchOpenGraph("https://www.instagram.com/p/example/")).toMatchObject({ title: "A real Instagram post" });
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("rejects a Reddit login/homepage result instead of caching it as the post", async () => {
    const service = new OpenGraphService();
    vi.spyOn(service as any, "fetchFromMicrolink").mockResolvedValue({ title: "Welcome to Reddit" });
    const direct = vi.spyOn(service as any, "fetchWithRetry").mockResolvedValue(null);
    expect(await service.fetchOpenGraph("https://www.reddit.com/r/test/comments/123/")).toBeNull();
    expect(direct).toHaveBeenCalledTimes(1);
  });
  it("shares provider requests for the same URL", async () => {
    const service = new OpenGraphService();
    const provider = vi.spyOn(service as any, "fetchFromMicrolink").mockResolvedValue({ title: "An actual post", image: "https://example.com/image.jpg" });
    await Promise.all([service.fetchOpenGraph("https://example.com/"), service.fetchOpenGraph("https://example.com/")]);
    expect(provider).toHaveBeenCalledTimes(1);
    await service.fetchOpenGraph("https://example.com/");
    expect(provider).toHaveBeenCalledTimes(1);
  });
});
