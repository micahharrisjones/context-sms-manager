type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void | Promise<unknown>;
    };
  }
}

// The publishing proxy supplies the tracker; no script or credentials belong here.
export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;
  try {
    const result = window.umami?.track(name, data);
    if (result) void Promise.resolve(result).catch(() => {});
  } catch {
    // Optional analytics must never interrupt an action.
  }
}

// Build payloads explicitly: never spread API responses or user content into events.
function category(value: unknown, allowed: readonly string[]): string {
  return typeof value === "string" && allowed.includes(value) ? value : "unknown";
}

function boundedCount(value: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.floor(value))) : 0;
}

export function trackKnowledgeSearch(answerStatus: unknown, searchMethod: unknown, resultCount: number, citationCount: number): void {
  trackEvent("knowledge_search_completed", {
    answer_status: category(answerStatus, ["ready", "unavailable", "insufficient", "disabled"]),
    search_method: category(searchMethod, ["hybrid", "keyword"]),
    result_count: boundedCount(resultCount, 100),
    citation_count: boundedCount(citationCount, 100),
  });
}

export function trackKnowledgeCitation(sourceKind: unknown): void {
  trackEvent("knowledge_cited_source_inspected", {
    source_kind: category(sourceKind, ["note", "page", "photo", "preview"]),
  });
}

export function trackKnowledgeBackfill(queuedCount: number): void {
  trackEvent("knowledge_older_saves_queued", { queued_count: boundedCount(queuedCount, 20) });
}
