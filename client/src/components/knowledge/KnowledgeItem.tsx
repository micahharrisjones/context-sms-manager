import { useEffect, useState } from "react";
import { AlertCircle, BookOpen, ChevronDown, ChevronUp, LoaderCircle, RotateCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { KnowledgeDetail, KnowledgeState } from "@shared/knowledge";

const labels: Record<KnowledgeState, string> = {
  not_indexed: "Not in your library yet",
  queued: "Waiting to be processed",
  processing: "Being processed",
  ready: "Ready for answers",
  partial: "Partially available",
  blocked: "Source unavailable",
  unsupported: "Not supported",
  failed: "Processing didn't finish",
  paused: "Analysis is paused",
};

function statusTone(status: KnowledgeState) {
  if (status === "ready") return "bg-[#e7efe5] text-[#49624c]";
  if (status === "queued" || status === "processing") return "bg-[#f4ecd9] text-[#866634]";
  if (status === "failed" || status === "blocked") return "bg-[#f8e9e2] text-[#98513d]";
  return "bg-[#eeeae1] text-[#686d68]";
}

export function KnowledgeItem({ messageId }: { messageId: number }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<KnowledgeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  async function loadDetail(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest(`/api/knowledge/items/${messageId}`, { signal });
      setDetail(await response.json() as KnowledgeDetail);
    } catch {
      if (!signal?.aborted) setError("Coverage details could not be loaded.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !detail || !["queued", "processing"].includes(detail.status)) return;
    const timer = window.setInterval(() => void loadDetail(), 3000);
    return () => window.clearInterval(timer);
  }, [open, detail?.status, messageId]);

  async function retry() {
    if (!detail?.canRetry || retrying) return;
    setRetrying(true);
    setError("");
    try {
      await apiRequest(`/api/knowledge/items/${messageId}/retry`, { method: "POST" });
      await loadDetail();
    } catch {
      setError("Retry couldn't be started. Please try again.");
    } finally {
      setRetrying(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail && !loading) void loadDetail();
  }

  return (
    <div className="mt-3 border-t border-[#eee6dc] pt-3">
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`knowledge-item-${messageId}`} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d9dfd3] bg-[#f7f7f1] px-3 text-xs font-medium text-[#435842] hover:bg-[#edf1e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526650]">
        <BookOpen className="h-3.5 w-3.5" />
        {open ? "Hide library coverage" : "Library coverage"}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div id={`knowledge-item-${messageId}`} className="mt-3 rounded-xl bg-[#f8f6f0] p-3">
          {loading && !detail ? <div className="h-14 animate-pulse rounded-lg bg-[#e9e4d9]" aria-label="Loading item coverage" /> : null}
          {error && <p className="flex items-center gap-2 text-xs text-[#9b4934]" role="alert"><AlertCircle className="h-3.5 w-3.5" />{error}<button onClick={() => void loadDetail()} className="underline underline-offset-2">Reload</button></p>}
          {detail && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(detail.status)}`}>{labels[detail.status]}</span>
                {detail.canRetry && (
                  <button type="button" onClick={retry} disabled={retrying} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#d9dfd3] px-3 text-xs font-medium text-[#435842] disabled:opacity-60">
                    {retrying ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                    Retry analysis
                  </button>
                )}
              </div>
              {(detail.status === "not_indexed" || detail.status === "paused") && (
                <p className="mt-2 text-xs leading-relaxed text-[#606c64]">Analysis is paused or has not started for this save. Daily limits can pause processing. Photos require separate opt-in. Existing extracts are preserved when analysis is turned off.</p>
              )}
              <p className="mt-2 text-xs text-[#68736d]">
                {detail.sources.length} {detail.sources.length === 1 ? "source" : "sources"} found. Coverage can be incomplete: some sites limit accessible text, and photos are analyzed only with photo opt-in.
              </p>
              {detail.sources.length > 0 && (
                <div className="mt-3 space-y-3">
                  {detail.sources.map((source) => (
                    <article key={source.id} className="rounded-lg border border-[#e7dfd3] bg-[#fffdf9] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold text-[#263d57]">{source.title || source.kind}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusTone(source.status)}`}>{labels[source.status]}</span>
                      </div>
                      {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-[11px] text-[#526650] underline underline-offset-2">{source.url}</a>}
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#69746c]">Source text</p><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[#3e4a51]">{source.text || "No source text was available."}</p></div>
                        <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#69746c]">Interpretations</p><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[#3e4a51]">{source.observations || "No interpretation available."}</p></div>
                      </div>
                      {source.truncated && <p className="mt-2 text-[11px] text-[#856c45]">This source extract is shortened; it may not include the full save.</p>}
                      {source.reason && <p className="mt-2 text-[11px] text-[#856c45]">{source.reason}</p>}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
