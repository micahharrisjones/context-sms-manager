import { describe, expect, it } from "vitest";
import { isGenericPreview, storedMoviePreview, storedPreviewMatches } from "../../shared/preview-urls";

describe("legacy saved previews", () => {
  const url = "https://www.imdb.com/title/tt0133093/";
  it("restores a single-link legacy poster without a source field", () => {
    expect(storedMoviePreview({ content: `${url} #movies`, ogImage: "https://example.com/poster.jpg", ogTitle: "The Matrix" }, url))
      .toMatchObject({ title: "The Matrix", posterUrl: "https://example.com/poster.jpg" });
  });
  it("supports legacy Instagram and TikTok thumbnails", () => {
    for (const link of ["https://www.instagram.com/p/example/", "https://www.tiktok.com/@user/video/123"]) {
      expect(storedPreviewMatches(null, link, `${link} #saved`)).toBe(true);
    }
  });
  it("never assigns ambiguous legacy metadata to either of two links", () => {
    const content = `${url} https://example.com/`;
    expect(storedPreviewMatches(null, url, content)).toBe(false);
    expect(storedMoviePreview({ content, ogImage: "https://example.com/poster.jpg" }, url)).toBeNull();
  });
  it("never uses the legacy rule to override a known source mismatch", () => {
    expect(storedPreviewMatches("https://example.com/", url, url)).toBe(false);
  });
  it("does not manufacture a poster for a post without stored images", () => {
    expect(storedMoviePreview({ content: url, ogTitle: "Imdb" }, url)).toBeNull();
  });
  it("recognizes login/homepage metadata, but not real post titles", () => {
    expect(isGenericPreview("https://www.reddit.com/r/test/comments/123/", "Welcome to Reddit")).toBe(true);
    expect(isGenericPreview("https://www.reddit.com/r/test/comments/123/", "Reddit - Dive into anything")).toBe(true);
    expect(isGenericPreview("https://www.reddit.com/r/test/comments/123/", "A post about Reddit")).toBe(false);
    expect(isGenericPreview(url, "Imdb")).toBe(true);
    expect(isGenericPreview(url, "The Matrix (1999) - IMDb")).toBe(false);
  });
});
