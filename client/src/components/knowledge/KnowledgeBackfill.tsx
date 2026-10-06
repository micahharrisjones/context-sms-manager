import { useEffect, useRef, useState } from "react";
import { AlertCircle, Archive, LoaderCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { trackKnowledgeBackfill } from "@/lib/analytics";

interface BackfillEstimate {
  count: number;
  limit: number;
  estimatedPassagesUpperBound: number;
}

export function KnowledgeBackfill() {
  const [estimate, setEstimate] = useState<BackfillEstimate | null>(null);
  const [queued, setQueued] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => { controllerRef.current?.abort(); }, []);

  async function preview() {
    if (controllerRef.current && !controllerRef.current.signal.aborted) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    setQueued(null);
    try {
      const response = await apiRequest("/api/knowledge/backfill", {
        method: "POST",
        body: JSON.stringify({ dryRun: true, limit: 20 }),
        signal: controller.signal,
      });
      const result = await response.json() as BackfillEstimate;
      if (controller.signal.aborted) return;
      setEstimate(result);
      setConfirming(false);
    } catch {
      if (!controller.signal.aborted) setError("The estimate is unavailable right now. Try again.");
    } finally {
      if (!controller.signal.aborted) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }

  async function startBatch() {
    if (!confirming || (controllerRef.current && !controllerRef.current.signal.aborted)) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/api/knowledge/backfill", {
        method: "POST",
        body: JSON.stringify({ dryRun: false, confirm: true, limit: 20 }),
        signal: controller.signal,
      });
      const result = await response.json() as { queued: number };
      if (controller.signal.aborted) return;
      setQueued(result.queued);
      setEstimate(null);
      setConfirming(false);
      trackKnowledgeBackfill(result.queued);
    } catch {
      if (!controller.signal.aborted) setError("The batch couldn't be queued. No changes were made; try again.");
    } finally {
      if (!controller.signal.aborted) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <section className="rounded-2xl border border-[#e6d8c8] bg-[#fffdf9] p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f3e8db] text-[#946344]"><Archive className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-[#263d57]">Bring older saves into your library</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#64717b]">A batch checks up to 20 saves at a time. A dry run is free of processing work; confirm separately before any batch is queued. Processing may incur OpenAI charges.</p>
          <button type="button" onClick={preview} disabled={loading} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#c8d2c1] px-4 text-sm font-medium text-[#435842] transition-colors hover:bg-[#edf1e9] disabled:opacity-60">
            {loading && !confirming ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Estimate a batch
          </button>
        </div>
      </div>
      {estimate && (
        <div className="mt-4 rounded-xl bg-[#f4f3ea] p-4">
          <p className="text-sm text-[#263d57]">This batch includes <strong>{estimate.count}</strong> saves (limit {estimate.limit}), with up to <strong>{estimate.estimatedPassagesUpperBound}</strong> passages to process.</p>
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className="mt-3 min-h-10 rounded-full bg-[#526650] px-4 text-sm font-medium text-white hover:bg-[#435842]">Review and confirm batch</button>
          ) : (
            <div role="group" aria-label="Confirm batch processing" className="mt-3 rounded-xl border border-[#ddc4a4] bg-[#fffaf0] p-3">
              <p className="text-sm font-medium text-[#584c3c]">Queue this batch now?</p>
              <p className="mt-1 text-xs leading-relaxed text-[#6a6255]">This starts processing and may incur OpenAI charges. Only proceed if you agree.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={startBatch} disabled={loading} className="min-h-10 rounded-full bg-[#526650] px-4 text-sm font-medium text-white disabled:opacity-60">{loading ? "Queueing…" : "Yes, queue batch"}</button>
                <button type="button" onClick={() => setConfirming(false)} disabled={loading} className="min-h-10 rounded-full border border-[#d4c9b8] px-4 text-sm text-[#5d625a]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {queued !== null && <p className="mt-3 text-sm text-[#49624c]" role="status">{queued} {queued === 1 ? "save was" : "saves were"} queued for processing.</p>}
      {error && <p className="mt-3 flex items-center gap-2 text-xs text-[#9b4934]" role="alert"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
    </section>
  );
}
