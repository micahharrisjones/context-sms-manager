import { useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useLocation } from "wouter";
import { AlertCircle, ArrowRight, Check, LoaderCircle, Search, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import type { LibraryScanStatus } from "@shared/knowledge";

const SESSION_KEY_PREFIX = "aside-library-scan-deferred:";
const STATUS_URL = "/api/knowledge/library-scan";
const POLL_INTERVAL_MS = 3500;

function sessionKey(userId: number) {
  return `${SESSION_KEY_PREFIX}${userId}`;
}

function safelyDeferred(userId: number) {
  try {
    return window.sessionStorage.getItem(sessionKey(userId)) === "1";
  } catch {
    return false;
  }
}

function deferForSession(userId: number) {
  try {
    window.sessionStorage.setItem(sessionKey(userId), "1");
  } catch {
    // The prompt can still close if storage is unavailable; it may return this session.
  }
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getProgress(status: LibraryScanStatus) {
  if (status.total <= 0) return 0;
  return Math.min(100, Math.max(0, (status.processed / status.total) * 100));
}

export function SearchUpgradePrompt() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, needsProfileSetup } = useProfile();
  const [, setLocation] = useLocation();
  const userId = user?.id;
  const [readyUserId, setReadyUserId] = useState<number | null>(null);
  const [deferred, setDeferred] = useState(false);
  const [status, setStatus] = useState<LibraryScanStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [starting, setStarting] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reloadStatus, setReloadStatus] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const actionRef = useRef<AbortController | null>(null);

  const eligible = Boolean(
    !authLoading &&
    isAuthenticated &&
    userId &&
    !profileLoading &&
    profile &&
    !needsProfileSetup
  );

  useEffect(() => {
    actionRef.current?.abort();
    setStarting(false);
    setAcknowledging(false);
    setMinimized(false);
    if (!userId) {
      setReadyUserId(null);
      setDeferred(false);
      setStatus(null);
      return;
    }
    setStatus(null);
    setStatusError("");
    setActionError("");
    setDeferred(safelyDeferred(userId));
    setReadyUserId(userId);
  }, [userId]);

  const fetchStatus = useCallback(async (signal?: AbortSignal) => {
    const response = await apiRequest(STATUS_URL, { signal });
    return response.json() as Promise<LibraryScanStatus>;
  }, []);

  useEffect(() => {
    if (!eligible || !userId || readyUserId !== userId || deferred) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadingStatus(true);
    setStatusError("");
    fetchStatus(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setStatus(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatusError("We couldn't check your library scan status.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStatus(false);
        if (requestRef.current === controller) requestRef.current = null;
      });
    return () => {
      controller.abort();
      if (requestRef.current === controller) requestRef.current = null;
    };
  }, [eligible, userId, readyUserId, deferred, reloadStatus, fetchStatus]);

  // A single timeout follows each completed request, so polling never overlaps.
  useEffect(() => {
    if (!eligible || !userId || deferred || status?.status !== "running") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let cancelled = false;
    const poll = async () => {
      if (requestRef.current && !requestRef.current.signal.aborted) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }
      controller = new AbortController();
      requestRef.current = controller;
      try {
        const next = await fetchStatus(controller.signal);
        if (!cancelled && !controller.signal.aborted) {
          setStatus(next);
          setStatusError("");
        }
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          setStatusError("Progress couldn't be refreshed. The scan may still be running.");
        }
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
        if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };
    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [eligible, userId, deferred, status?.status, fetchStatus]);

  useEffect(() => () => {
    requestRef.current?.abort();
    actionRef.current?.abort();
  }, []);

  const closePrompt = useCallback(() => {
    if (!userId) return;
    if (status?.status === "running") {
      setMinimized(true);
      return;
    }
    deferForSession(userId);
    setDeferred(true);
    requestRef.current?.abort();
  }, [userId, status?.status]);

  async function startScan() {
    if (starting || !status || !status.available) return;
    const controller = new AbortController();
    actionRef.current = controller;
    setStarting(true);
    setActionError("");
    try {
      const response = await apiRequest(STATUS_URL, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
        signal: controller.signal,
      });
      const next = await response.json() as LibraryScanStatus;
      if (controller.signal.aborted) return;
      setStatus(next);
      if (!status.analysisEnabled && next.analysisEnabled) {
        window.dispatchEvent(new Event("aside-knowledge-settings-changed"));
      }
      setStatusError("");
    } catch {
      if (!controller.signal.aborted) setActionError("We couldn't confirm that the scan started. Retry to resume or check its status.");
    } finally {
      if (!controller.signal.aborted) setStarting(false);
      if (actionRef.current === controller) actionRef.current = null;
    }
  }

  async function acknowledgeCompletion(destination: "search" | "close") {
    if (acknowledging) return;
    const controller = new AbortController();
    actionRef.current = controller;
    setAcknowledging(true);
    setActionError("");
    try {
      await apiRequest(`${STATUS_URL}/dismiss`, { method: "POST", signal: controller.signal });
      if (controller.signal.aborted) return;
      setStatus((current) => current ? { ...current, status: "dismissed" } : current);
      setDeferred(true);
      if (destination === "search") setLocation("/search");
    } catch {
      if (!controller.signal.aborted) setActionError("We couldn't save that this scan is complete. Retry, or close this prompt for now.");
    } finally {
      if (!controller.signal.aborted) setAcknowledging(false);
      if (actionRef.current === controller) actionRef.current = null;
    }
  }

  if (!eligible || !userId || readyUserId !== userId || deferred) return null;

  const terminalHidden = status?.status === "dismissed";
  if (terminalHidden) return null;
  if (minimized && status?.status === "running") return null;

  const open = Boolean(statusError) || Boolean(status);
  const isCompleted = status?.status === "completed";
  const isRunning = status?.status === "running";
  const progress = status ? getProgress(status) : 0;
  const canStart = Boolean(status?.available);

  function onOpenChange(nextOpen: boolean) {
    if (nextOpen) return;
    closePrompt();
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-[#263d57]/35 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          onPointerDownOutside={(event) => event.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[101] flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[620px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-[28px] border border-[#e7ddcf] bg-[#fffdf8] text-[#263d57] shadow-[0_28px_90px_rgba(37,52,61,0.24)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none sm:w-[calc(100%-3rem)]"
          aria-describedby="search-upgrade-description"
        >
          {!status && (
            <>
              <DialogPrimitive.Title className="sr-only">Aside search upgrade</DialogPrimitive.Title>
              <DialogPrimitive.Description id="search-upgrade-description" className="sr-only">
                Check the status of indexing older saves for Aside search.
              </DialogPrimitive.Description>
            </>
          )}
          {(
            <button
              type="button"
              disabled={acknowledging}
              onClick={closePrompt}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full text-[#67736d] transition-colors hover:bg-[#f1eee6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526650] motion-reduce:transition-none"
              aria-label={isRunning ? "Close; scan continues in background" : "Close for this login session"}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div className="px-5 pb-6 pt-7 sm:px-9 sm:pb-8 sm:pt-9">
            <div className="mb-6 flex items-center gap-3">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-[#e9eee5] text-[#526650]">
                <Search className="h-5 w-5" strokeWidth={1.8} />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#fffdf8] bg-[#d8a577] text-[#fffdf8]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b876f]">A better way back</p>
                <p className="mt-1 text-xs text-[#748078]">Aside search, rebuilt</p>
              </div>
            </div>

            {loadingStatus && !status && !statusError ? (
              <div className="py-5" role="status" aria-live="polite">
                <div className="h-8 w-3/4 animate-pulse rounded-lg bg-[#eee9df]" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-[#f1ede5]" />
                <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-[#f1ede5]" />
                <div className="mt-7 h-12 w-44 animate-pulse rounded-full bg-[#e7ebdf]" />
              </div>
            ) : statusError && !status ? (
              <div role="alert" className="rounded-2xl border border-[#e8c9bd] bg-[#fff8f3] p-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#a65e46]" />
                  <div>
                    <h2 className="font-semibold text-[#563e34]">Your scan status is unavailable</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#765f55]">{statusError} Retry before choosing what to do.</p>
                    <button type="button" onClick={() => setReloadStatus((value) => value + 1)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#526650] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#435842] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526650]">
                      Retry status <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : status ? (
              <>
                <DialogPrimitive.Title className="max-w-[490px] font-serif text-[2rem] leading-[1.08] tracking-[-0.035em] text-[#263d57] sm:text-[2.45rem]">
                  {isRunning ? "Your older saves are finding their way in." : isCompleted ? status.indexed > 0 ? "Your library is ready to search." : "Your library scan is complete." : "Search your saves, with a little more context."}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description id="search-upgrade-description" className="mt-3 max-w-[510px] text-[14px] leading-[1.7] text-[#66736f] sm:text-[15px]">
                  {isCompleted
                    ? status.total === 0
                      ? "There were no older cards to index. You can still try search or start saving new cards."
                      : "Here’s how many older cards have searchable content, and how many couldn’t be indexed."
                    : isRunning
                      ? "We’re checking your older cards and adding readable content to your search index."
                      : "Aside search has been rebuilt with more robust AI. Index your older saves to find them by their content—not just the words you remember."}
                </DialogPrimitive.Description>

                {isRunning ? (
                  <section aria-labelledby="scan-progress-heading" className="mt-6 rounded-[20px] border border-[#dfe5d9] bg-[#f5f6ef] p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 id="scan-progress-heading" className="text-sm font-semibold text-[#394f42]">Indexing older saves</h2>
                        <p className="mt-1 text-sm text-[#69766d]">
                          {status.processed} of {status.total} {status.total === 1 ? "save" : "saves"} processed
                        </p>
                      </div>
                      <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#74866b] motion-reduce:animate-none" aria-label="Scan in progress" />
                    </div>
                    <div
                      className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#e2e5dc]"
                      role="progressbar"
                      aria-label="Older saves processed"
                      aria-valuemin={0}
                      aria-valuemax={status.total}
                      aria-valuenow={Math.min(status.total, Math.max(0, status.processed))}
                      aria-valuetext={`${status.processed} of ${status.total} saves processed`}
                    >
                      <div className="h-full rounded-full bg-[#71836a] transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${progress}%` }} />
                    </div>
                    {statusError && (
                      <p role="status" className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#795c46]">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {statusError}
                        <button type="button" onClick={() => setReloadStatus((value) => value + 1)} className="shrink-0 font-semibold underline underline-offset-2">Retry status</button>
                      </p>
                    )}
                    <p className="mt-4 border-t border-[#e1e5dc] pt-3 text-xs leading-relaxed text-[#68756d]">
                      You can close this and keep using Aside. The scan continues in the background. Daily limits or unreadable content may leave some cards unindexed.
                    </p>
                  </section>
                ) : isCompleted ? (
                  <section className="mt-6 rounded-[20px] border border-[#dfe5d9] bg-[#f5f6ef] p-4 sm:p-5" aria-labelledby="scan-complete-heading">
                    <h2 id="scan-complete-heading" className="text-sm font-semibold text-[#394f42]">Your scan results</h2>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-[#fffdf8] p-3.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7b876f]">Indexed</p>
                        <p className="mt-1 font-serif text-2xl text-[#344b3d]">{status.indexed}</p>
                        <p className="text-xs text-[#778078]">including {countLabel(status.partial, "partial save")}</p>
                      </div>
                      <div className="rounded-2xl bg-[#fffdf8] p-3.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8b715a]">Not indexed</p>
                        <p className="mt-1 font-serif text-2xl text-[#765b43]">{status.notIndexed}</p>
                        <p className="text-xs text-[#778078]">of {status.total} total saves</p>
                      </div>
                    </div>
                    {status.reasons.length > 0 && (
                      <div className="mt-4 border-t border-[#e1e5dc] pt-3">
                        <h3 className="text-xs font-semibold text-[#4d5c51]">Why some cards weren’t indexed</h3>
                        <ul className="mt-2 space-y-1.5">
                          {status.reasons.map(({ reason, count }, index) => (
                            <li key={`${reason}-${index}`} className="flex items-start justify-between gap-4 text-xs leading-relaxed text-[#68756d]">
                              <span>{reason}</span><span className="shrink-0 font-medium tabular-nums">{count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                ) : (
                  <div className="mt-6">
                    <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-[#66736f]" aria-label="Your library scan">
                      <span className="rounded-full border border-[#e3ddd0] bg-[#faf8f1] px-3 py-1.5">{countLabel(status.total, "older save")}</span>
                      {status.photoEnabled ? <span className="rounded-full border border-[#d9e1d4] bg-[#f0f3ec] px-3 py-1.5">Photos included by your existing choice</span> : <span className="rounded-full border border-[#e3ddd0] bg-[#faf8f1] px-3 py-1.5">Photos stay out</span>}
                    </div>

                    {status.total === 0 ? (
                      <div className="rounded-2xl border border-[#e5dfd3] bg-[#f8f6ef] px-4 py-4 text-sm leading-relaxed text-[#68736b]">
                        There are no older saves to index right now. New saves can still be found in Aside search.
                      </div>
                    ) : !status.available ? (
                      <div role="status" className="rounded-2xl border border-[#e8dfcf] bg-[#faf6ed] px-4 py-4 text-sm leading-relaxed text-[#70634f]">
                        Library analysis isn’t available right now, so this scan can’t start yet. Your saved items are unchanged.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[#e7ddcf] bg-[#faf8f1] px-4 py-4 text-[13px] leading-[1.7] text-[#68736b] sm:px-5">
                        <p>Starting this scan sends saved text and readable public links to OpenAI. AI usage charges may apply. Daily limits and unreadable pages may leave some cards unindexed.</p>
                        <p className="mt-2">Photos are included only if you already opted in; this scan does not change your photo choice.</p>
                        {!status.analysisEnabled && (
                          <p className="mt-2 font-medium text-[#735941]">Starting this scan will enable AI analysis for your library.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {actionError && (
                  <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#e8c9bd] bg-[#fff8f3] px-3.5 py-3 text-xs leading-relaxed text-[#8b4d39]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{actionError}
                  </p>
                )}

                <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col items-stretch gap-2.5 border-t border-[#eee9df] bg-[#fffdf8] px-5 py-3 sm:-mx-9 sm:items-start sm:px-9">
                  {isCompleted ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void acknowledgeCompletion("search")}
                        disabled={acknowledging}
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#526650] px-6 text-sm font-semibold text-white shadow-[0_5px_12px_rgba(67,88,66,0.15)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#435842] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#526650] disabled:cursor-wait disabled:opacity-65 motion-reduce:transition-none sm:w-auto"
                      >
                        {acknowledging ? "Saving…" : "try searching now"} {!acknowledging && <ArrowRight className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void acknowledgeCompletion("close")}
                        disabled={acknowledging}
                        className="min-h-10 self-center px-3 text-sm text-[#65736a] underline decoration-[#b6bcae] underline-offset-4 transition-colors hover:text-[#344b3d] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526650] disabled:opacity-60 sm:self-start"
                      >
                        I&apos;ll try it later
                      </button>
                    </>
                  ) : (
                    <>
                      {!isRunning && (
                        <button
                          type="button"
                          onClick={() => void startScan()}
                          disabled={starting || !canStart}
                          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#526650] px-6 text-sm font-semibold text-white shadow-[0_5px_12px_rgba(67,88,66,0.15)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#435842] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#526650] disabled:cursor-wait disabled:opacity-65 motion-reduce:transition-none sm:w-auto"
                        >
                          {starting ? <><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Starting scan…</> : <>Scan and index older saves <ArrowRight className="h-4 w-4" /></>}
                        </button>
                      )}
                      {!isRunning && (
                        <button
                          type="button"
                          onClick={closePrompt}
                          className="min-h-10 self-center px-3 text-sm text-[#65736a] underline decoration-[#b6bcae] underline-offset-4 transition-colors hover:text-[#344b3d] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526650] sm:self-start"
                        >
                          let&apos;s do this next time
                        </button>
                      )}
                    </>
                  )}
                </div>

                {isRunning && (
                  <button
                    type="button"
                    onClick={closePrompt}
                    className="mt-2 min-h-10 px-3 text-sm text-[#65736a] underline decoration-[#b6bcae] underline-offset-4 transition-colors hover:text-[#344b3d] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526650]"
                  >
                    Close for now
                  </button>
                )}
              </>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
