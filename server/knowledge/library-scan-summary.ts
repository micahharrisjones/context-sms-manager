import type { LibraryScanStatus } from "@shared/knowledge";

export interface ScanEntry { messageId: number; fingerprint: string; reuse: boolean }
export interface ScanOutcome {
  messageId: number;
  fingerprint: string;
  status: string;
  hasText: boolean;
  errorCode: string | null;
  sources: { kind: string; status: string; reason?: string }[];
}
// Each card contributes once. A useful but incomplete extract is indexed partially,
// not a failed card. Queue admission is never counted as completed processing.
export function summarizeScan(entries: ScanEntry[], cursor: number, fingerprints: Map<number, string>,
  outcomes: ScanOutcome[], preferences: Pick<LibraryScanStatus, "available" | "photoEnabled" | "analysisEnabled">): LibraryScanStatus {
  const byId = new Map(outcomes.map(item => [item.messageId, item]));
  const reasons = new Map<string, number>();
  let processed = 0, indexed = 0, partial = 0;
  entries.forEach((entry, position) => {
    let reason: string | undefined;
    const item = byId.get(entry.messageId);
    if (fingerprints.get(entry.messageId) !== entry.fingerprint) {
      reason = "Card changed or was removed during the scan";
    } else if (position >= cursor && !entry.reuse) {
      return;
    } else if (!item || item.fingerprint !== entry.fingerprint || ["queued", "processing"].includes(item.status)) {
      return;
    } else if (["ready", "partial"].includes(item.status) && item.hasText) {
      processed++; indexed++;
      if (item.status === "partial") partial++;
      return;
    } else if (item.errorCode?.startsWith("daily_") || item.sources.some(s => /daily .*limit/i.test(s.reason || ""))) {
      reason = "Daily AI processing limit reached";
    } else if (item.errorCode === "analysis_disabled") {
      reason = "AI analysis was turned off";
    } else if (item.sources.some(s => s.kind === "photo" && s.status === "paused")) {
      reason = "Photo analysis requires separate opt-in";
    } else if (item.sources.some(s => s.kind === "photo" && /audio|video/i.test(s.reason || ""))) {
      reason = "Audio or video analysis is not supported";
    } else if (item.status === "blocked" || item.sources.some(s => s.status === "blocked")) {
      reason = "Private, paywalled or blocked link could not be read";
    } else if (item.status === "failed") {
      reason = "Content could not be retrieved or AI processing failed";
    } else {
      reason = "No readable source content was available";
    }
    processed++;
    reasons.set(reason, (reasons.get(reason) || 0) + 1);
  });
  return {
    status: cursor >= entries.length && processed === entries.length ? "completed" : "running",
    total: entries.length, processed, indexed, partial, notIndexed: processed - indexed,
    reasons: [...reasons].map(([reason, count]) => ({ reason, count })), ...preferences,
  };
}
