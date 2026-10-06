import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent, trackKnowledgeBackfill, trackKnowledgeCitation, trackKnowledgeSearch } from "../../client/src/lib/analytics";

afterEach(() => vi.unstubAllGlobals());

describe("privacy-safe knowledge analytics", () => {
  it("allowlists categories and caps counts without accepting private response fields", () => {
    const track = vi.fn();
    vi.stubGlobal("window", { umami: { track } });
    trackKnowledgeSearch("private provider error", "private query", 500, 300);
    trackKnowledgeCitation("https://private.test/photo?signed=secret");
    trackKnowledgeBackfill(200);
    expect(track.mock.calls).toEqual([
      ["knowledge_search_completed", { answer_status: "unknown", search_method: "unknown", result_count: 100, citation_count: 100 }],
      ["knowledge_cited_source_inspected", { source_kind: "unknown" }],
      ["knowledge_older_saves_queued", { queued_count: 20 }],
    ]);
  });

  it("normalizes invalid, negative and fractional counts", () => {
    const track = vi.fn();
    vi.stubGlobal("window", { umami: { track } });
    trackKnowledgeSearch("ready", "hybrid", -4, NaN);
    trackKnowledgeSearch("disabled", "keyword", 3.9, Infinity);
    trackKnowledgeBackfill(-1);
    expect(track.mock.calls).toEqual([
      ["knowledge_search_completed", { answer_status: "ready", search_method: "hybrid", result_count: 0, citation_count: 0 }],
      ["knowledge_search_completed", { answer_status: "disabled", search_method: "keyword", result_count: 3, citation_count: 0 }],
      ["knowledge_older_saves_queued", { queued_count: 0 }],
    ]);
  });

  it("works without a browser or tracker", () => {
    vi.stubGlobal("window", undefined);
    expect(() => trackEvent("test")).not.toThrow();
    vi.stubGlobal("window", {});
    expect(() => trackKnowledgeCitation("photo")).not.toThrow();
  });

  it("swallows synchronous and asynchronous tracker failures", async () => {
    vi.stubGlobal("window", { umami: { track: () => { throw new Error("tracker"); } } });
    expect(() => trackKnowledgeBackfill(1)).not.toThrow();
    vi.stubGlobal("window", { umami: { track: () => Promise.reject(new Error("tracker")) } });
    trackKnowledgeSearch("ready", "hybrid", 1, 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
