import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TMDBService } from "../tmdb-service";
import { fetchMoviePreview } from "../../client/src/lib/movie-preview";
import { clearLinkPreviewCache, fetchLinkPreview } from "../../client/src/lib/link-preview";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const url = "https://www.imdb.com/title/tt3647214/";

beforeEach(() => clearLinkPreviewCache());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); clearLinkPreviewCache(); });

describe("IMDb catalogue and provider fallbacks", () => {
  it("looks up a TV poster and genres using TV endpoints", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ movie_results: [], tv_results: [{ id: 1399, name: "Game of Thrones", poster_path: "/poster.jpg", first_air_date: "2011-04-17", vote_average: 8.5 }] }))
      .mockResolvedValueOnce(json({ genres: [{ name: "Drama" }] }));
    vi.stubGlobal("fetch", fetcher);
    const result = await new TMDBService("test-only-placeholder").getMoviePoster("tt0944947");
    expect(result).toMatchObject({ title: "Game of Thrones", year: "2011", genres: ["Drama"], posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg" });
    expect(fetcher.mock.calls[1][0]).toContain("/tv/1399?");
  });
  it("keeps the existing movie path working", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ movie_results: [{ id: 603, title: "The Matrix", poster_path: "/matrix.jpg", release_date: "1999-03-31" }] }))
      .mockResolvedValueOnce(json({ genres: [{ name: "Action" }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await new TMDBService("test-only-placeholder").getMoviePoster("tt0133093")).toMatchObject({ title: "The Matrix", year: "1999" });
    expect(fetcher.mock.calls[1][0]).toContain("/movie/603?");
  });
  it("uses page metadata when TMDB returns 404", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ error: "Not found" }, 404))
      .mockResolvedValueOnce(json({ title: "An IMDb title", image: "https://example.com/poster.jpg" }));
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchMoviePreview("tt3647214", url)).toMatchObject({ title: "An IMDb title", posterUrl: "https://example.com/poster.jpg" });
    expect(fetcher.mock.calls[1][0]).toContain("/api/og-preview?");
  });
  it("also tries page metadata during a TMDB network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(json({ title: "A real title", image: "https://example.com/poster.jpg" })));
    expect((await fetchMoviePreview("tt3647214", url))?.posterUrl).toBe("https://example.com/poster.jpg");
  });
  it("does not make up an image or movie title when both providers fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json({ title: "Imdb", isFallback: true })));
    expect(await fetchMoviePreview("tt3647214", url)).toBeNull();
  });
  it("does not request page metadata when TMDB already has a poster", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ title: "The Matrix", posterUrl: "https://example.com/matrix.jpg" }));
    vi.stubGlobal("fetch", fetcher);
    expect((await fetchMoviePreview("tt0133093", url))?.title).toBe("The Matrix");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("feed preview request sharing", () => {
  it("shares concurrent and repeated lookups across cards", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ title: "A link", image: "https://example.com/image.jpg" }));
    vi.stubGlobal("fetch", fetcher);
    const first = fetchLinkPreview(url);
    expect(fetchLinkPreview(url)).toBe(first);
    await first;
    await fetchLinkPreview(url);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("allows a retry after rate limits rather than caching failure permanently", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ error: "Rate limited" }, 429)).mockResolvedValueOnce(json({ title: "Recovered" }));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchLinkPreview(url)).rejects.toThrow("429");
    expect((await fetchLinkPreview(url)).title).toBe("Recovered");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
