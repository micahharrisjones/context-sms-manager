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

export function storedPreviewMatches(sourceUrl: string | null | undefined, displayedUrl: string | null): boolean {
  // Legacy metadata has no reliable source association. Fetch it afresh.
  return !!sourceUrl && sourceUrl === displayedUrl;
}
