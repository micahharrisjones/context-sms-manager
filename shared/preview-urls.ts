// Shared by enrichment and rendering so metadata always describes the same URL.
export function extractPreviewUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  return [...new Set(matches.map((match) => {
    let url = match.replace(/[.,;:!?]+$/, "");
    while (url.endsWith(")") && (url.match(/\)/g)?.length || 0) > (url.match(/\(/g)?.length || 0)) {
      url = url.slice(0, -1);
    }
    url = url.replace(/[\]}]+$/, "");
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
    } catch {
      return "";
    }
  }).filter(Boolean))];
}

export function storedPreviewMatches(sourceUrl: string | null | undefined, displayedUrl: string | null, legacyContent?: string): boolean {
  if (!displayedUrl) return false;
  if (sourceUrl) return sourceUrl === displayedUrl;
  // Before source URLs were stored, enrichment always used the first URL.
  // Reuse a legacy record only when there is exactly one distinct link.
  // New edits clear this metadata, and multi-link records still require a fetch.
  const urls = legacyContent === undefined ? [] : extractPreviewUrls(legacyContent);
  return urls.length === 1 && urls[0] === displayedUrl;
}

export function isGenericPreview(url: string, title?: string | null): boolean {
  if (!title) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const text = title.trim().toLowerCase();
    if (host === "reddit.com" || host.endsWith(".reddit.com")) {
      return /^(welcome to reddit|reddit|reddit[ :\-–—]+(dive into anything|the heart of the internet))$/.test(text);
    }
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      return /^(instagram|login[ •|\-–—]+instagram|instagram[ •|\-–—]+login)$/.test(text);
    }
    if (host === "imdb.com" || host.endsWith(".imdb.com")) {
      return /^(imdb|imdb[: ]+ratings, reviews.*)$/.test(text);
    }
  } catch { /* An invalid URL is handled by the caller. */ }
  return false;
}

export function storedMoviePreview(message: {
  content: string;
  ogSourceUrl?: string | null;
  ogImage?: string | null;
  ogTitle?: string | null;
}, url: string | null) {
  if (!message.ogImage || !storedPreviewMatches(message.ogSourceUrl, url, message.content)) return null;
  return {
    posterUrl: message.ogImage,
    title: message.ogTitle || "IMDb title",
    year: null, rating: null, genres: null,
  };
}
