import { describe, expect, it } from "vitest";
import { summarizeScan, type ScanEntry, type ScanOutcome } from "../knowledge/library-scan-summary";

const prefs = { available: true, photoEnabled: false, analysisEnabled: true };
const entries = (n: number): ScanEntry[] => Array.from({ length: n }, (_, i) => ({ messageId: i + 1, fingerprint: "same", reuse: false }));
const outcome = (messageId: number, overrides: Partial<ScanOutcome> = {}): ScanOutcome => ({
  messageId, fingerprint: "same", status: "queued", hasText: false, errorCode: null, sources: [], ...overrides,
});
describe("older-library scan progress", () => {
  it("does not report queue admission or a first batch as completion", () => {
    const report = summarizeScan(entries(27), 20, new Map(entries(27).map(e => [e.messageId, e.fingerprint])),
      entries(27).map(e => outcome(e.messageId)), prefs);
    expect(report.status).toBe("running");
    expect(report.total).toBe(27);
    expect(report.processed).toBe(0);
  });
  it("counts usable partial extracts once and lists failed-card reasons without content", () => {
    const report = summarizeScan(entries(6), 6, new Map(entries(6).map(e => [e.messageId, "same"])), [
      outcome(1, { status: "ready", hasText: true }),
      outcome(2, { status: "partial", hasText: true }),
      outcome(3, { status: "paused", sources: [{ kind: "photo", status: "paused" }] }),
      outcome(4, { status: "paused", errorCode: "daily_ingestion_limit" }),
      outcome(5, { status: "blocked" }),
      outcome(6, { status: "failed" }),
    ], prefs);
    expect(report).toMatchObject({ status: "completed", processed: 6, indexed: 2, partial: 1, notIndexed: 4 });
    expect(report.reasons.reduce((sum, r) => sum + r.count, 0)).toBe(4);
    expect(report.reasons.map(r => r.reason)).toContain("Photo analysis requires separate opt-in");
    expect(report.reasons.map(r => r.reason)).toContain("Daily AI processing limit reached");
  });
  it("settles deleted/changed saves without attributing their replacement's index to the old snapshot", () => {
    const report = summarizeScan(entries(2), 2, new Map([[1, "new"]]), [outcome(1, { status: "ready", hasText: true })], prefs);
    expect(report).toMatchObject({ status: "completed", processed: 2, indexed: 0, notIndexed: 2 });
    expect(report.reasons).toEqual([{ reason: "Card changed or was removed during the scan", count: 2 }]);
  });
  it("handles an empty library without inventing processing", () => {
    expect(summarizeScan([], 0, new Map(), [], prefs)).toMatchObject({ status: "completed", total: 0, indexed: 0, notIndexed: 0 });
  });
  it("keeps leased jobs pending and doesn't count old failed states before admission", () => {
    expect(summarizeScan(entries(2), 1, new Map([[1, "same"], [2, "same"]]), [
      outcome(1, { status: "processing" }), outcome(2, { status: "failed" }),
    ], prefs)).toMatchObject({ status: "running", processed: 0 });
  });
});
