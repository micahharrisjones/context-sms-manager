import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, CalendarDays, Search, SearchX, Sparkles, X } from "lucide-react";
import Masonry from "react-masonry-css";
import type { KnowledgePreferences, KnowledgeSearchResponse } from "@shared/knowledge";
import { apiRequest } from "@/lib/queryClient";
import { trackKnowledgeCitation, trackKnowledgeSearch } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { MessageCard } from "@/components/messages/MessageCard";
import { KnowledgeBackfill } from "@/components/knowledge/KnowledgeBackfill";
import { KnowledgePreferencesPanel } from "@/components/knowledge/KnowledgePreferencesPanel";

const RECENT_SEARCHES_KEY = "aside-recent-searches";
const MAX_RECENT = 5;

interface KnowledgeScope {
  id: number;
  name: string;
  ambiguous: boolean;
}

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const recent = getRecentSearches().filter((value) => value !== trimmed);
  recent.unshift(trimmed);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

const SUGGESTIONS = ["what recipes have I saved?", "find links about AI", "show me my travel ideas", "what movies did I save?", "gift ideas"];
const BREAKPOINT_COLUMNS = { default: 3, 1100: 2, 700: 1 };

function Summary({ text }: { text: string }) {
  return (
    <div data-testid="knowledge-answer" className="mx-auto max-w-3xl rounded-2xl border border-[#e2d6c8] bg-[#fffdf9] p-4 md:p-5">
      <div className="flex items-start gap-3">
        <img src="/aside-logo-loader.png" alt="Aside" className="mt-0.5 h-8 w-8 object-contain" />
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#72806f]">From your saves</p><p className="mt-1 text-sm leading-relaxed text-[#263d57]">{text}</p></div>
      </div>
    </div>
  );
}

function Coverage({ response }: { response: KnowledgeSearchResponse }) {
  const { coverage } = response;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[#f4f2e9] px-3 py-2 text-[11px] text-[#64716a]">
      <span className="font-semibold text-[#465849]">Library coverage</span>
      <span>{coverage.ready} ready</span><span>{coverage.partial} partial</span><span>{coverage.pending} pending</span>
      {(coverage.failed > 0 || coverage.unindexed > 0) && <span>{coverage.failed + coverage.unindexed} not yet available</span>}
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches);
  const [response, setResponse] = useState<KnowledgeSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preferences, setPreferences] = useState<KnowledgePreferences | null>(null);
  const [scopes, setScopes] = useState<KnowledgeScope[]>([]);
  const [scopesError, setScopesError] = useState(false);
  const [boardId, setBoardId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filterError, setFilterError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const inspectedCitationsRef = useRef(new Set<string>());

  useEffect(() => () => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest("/api/knowledge/scopes", { signal: controller.signal })
      .then((result) => result.json() as Promise<{ boards: KnowledgeScope[] }>)
      .then((data) => setScopes(data.boards))
      .catch(() => { if (!controller.signal.aborted) setScopesError(true); });
    const urlQuery = new URLSearchParams(window.location.search).get("q");
    if (urlQuery) setQuery(urlQuery.slice(0, 800));
    return () => controller.abort();
  }, []);

  const clearResults = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    inspectedCitationsRef.current.clear();
    setResponse(null);
    setError("");
    setLoading(false);
    setSubmittedQuery("");
  }, []);

  const handlePreferencesChange = useCallback((next: KnowledgePreferences) => {
    clearResults();
    setPreferences(next);
  }, [clearResults]);

  function changeFilter(change: () => void) {
    clearResults();
    setFilterError("");
    change();
  }

  async function submitSearch(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = query.trim().slice(0, 800);
    if (!trimmed) return;
    if (from && to && from > to) {
      setFilterError("The start date must be on or before the end date.");
      return;
    }
    setFilterError("");
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    setResponse(null);
    setError("");
    setSubmittedQuery(trimmed);
    setLoading(true);

    const params = new URLSearchParams({ q: trimmed, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
    if (boardId) params.set("boardId", boardId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const result = await apiRequest(`/api/ai-search?${params.toString()}`, { signal: controller.signal });
      const data = await result.json() as KnowledgeSearchResponse;
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      inspectedCitationsRef.current.clear();
      setResponse(data);
      trackKnowledgeSearch(data.answerStatus, data.searchMethod, data.messages.length, data.citations.length);
      saveRecentSearch(trimmed);
      setRecentSearches(getRecentSearches());
    } catch {
      if (!controller.signal.aborted && requestId === requestIdRef.current) setError("We couldn't search your library just now. Please try again.");
    } finally {
      if (!controller.signal.aborted && requestId === requestIdRef.current) setLoading(false);
    }
  }

  function selectRecent(value: string) {
    clearResults();
    setQuery(value.slice(0, 800));
    inputRef.current?.focus();
  }

  function clearQuery() {
    clearResults();
    setQuery("");
    inputRef.current?.focus();
  }

  const hasSubmitted = submittedQuery.length > 0;
  const citations = response?.citations ?? [];

  return (
    <div className="min-h-[70dvh] space-y-5 pb-8 md:space-y-6">
      <header className={`mx-auto max-w-4xl text-center transition-[padding] duration-300 ${hasSubmitted || query ? "pt-2 pb-1" : "pt-7 pb-2 md:pt-12"}`}>
        {!query && !hasSubmitted && (
          <div className="mb-6">
            <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9eee5] text-[#526650]"><Sparkles className="h-7 w-7" /></span>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b876f]">A library that remembers</p>
            <h1 className="text-2xl font-medium tracking-tight text-[#263d57] md:text-3xl">Ask Aside about your saves</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#64717b]">Find the links, photos and notes you tucked away. Answers point back to the original save.</p>
          </div>
        )}
        <form onSubmit={submitSearch} className="mx-auto max-w-3xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6a7968]" />
            <Input
              ref={inputRef}
              type="search"
              maxLength={800}
              placeholder="Ask anything about your saved content…"
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 800))}
              className="h-14 rounded-2xl border border-[#d9cabb] bg-[#fffdf9] pl-12 pr-28 text-base text-[#263d57] shadow-[0_5px_18px_rgba(74,73,55,0.07)] placeholder:text-[#89918b] focus-visible:ring-[#526650] md:text-lg"
              data-testid="input-search-page"
              data-pendo="input-search"
              aria-label="Search your saved links, photos and notes"
            />
            {query && <button type="button" onClick={clearQuery} className="absolute right-[6.7rem] top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#68746d] hover:bg-[#f0ede5]" aria-label="Clear search"><X className="h-4 w-4" /></button>}
            <button type="submit" disabled={!query.trim()} className="absolute right-2 top-1/2 inline-flex h-10 -translate-y-1/2 items-center gap-2 rounded-xl bg-[#526650] px-4 text-sm font-medium text-white transition-colors hover:bg-[#435842] disabled:cursor-not-allowed disabled:opacity-50">
              <Search className="h-4 w-4" /><span className="hidden sm:inline">{loading ? "Search again" : "Search"}</span>
            </button>
          </div>
          <div className="mt-3 grid gap-2 text-left sm:grid-cols-3">
            <label className="text-[11px] font-medium text-[#68746d]">
              <span className="mb-1 block">Scope</span>
              <select value={boardId} onChange={(event) => changeFilter(() => setBoardId(event.target.value))} className="h-10 w-full rounded-xl border border-[#ded5c8] bg-[#fffdf9] px-3 text-sm text-[#344351] focus:outline-none focus:ring-2 focus:ring-[#9eae96]" aria-label="Search scope">
                <option value="">My saves</option>
                {scopes.map((scope) => <option key={scope.id} value={scope.id} disabled={scope.ambiguous}>{scope.name}{scope.ambiguous ? " — unavailable" : ""}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-[#68746d]">
              <span className="mb-1 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> From</span>
              <input type="date" value={from} onChange={(event) => changeFilter(() => setFrom(event.target.value))} className="h-10 w-full rounded-xl border border-[#ded5c8] bg-[#fffdf9] px-3 text-sm text-[#344351] focus:outline-none focus:ring-2 focus:ring-[#9eae96]" aria-label="Filter from date" />
            </label>
            <label className="text-[11px] font-medium text-[#68746d]">
              <span className="mb-1 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> To</span>
              <input type="date" value={to} onChange={(event) => changeFilter(() => setTo(event.target.value))} className="h-10 w-full rounded-xl border border-[#ded5c8] bg-[#fffdf9] px-3 text-sm text-[#344351] focus:outline-none focus:ring-2 focus:ring-[#9eae96]" aria-label="Filter to date" />
            </label>
          </div>
          {filterError && <p className="mt-2 text-left text-xs text-[#9b4934]" role="alert">{filterError}</p>}
          {scopesError && <p className="mt-2 text-left text-xs text-[#9b4934]">Boards could not be loaded; you can still search My saves.</p>}
          <p className="mt-2 text-left text-[10px] text-[#7c847e]">Search runs only when you submit. Up to 800 characters. Dates use your local time zone.</p>
        </form>
      </header>

      <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-[1.35fr_1fr]">
        <KnowledgePreferencesPanel onSettingsChange={handlePreferencesChange} />
        <KnowledgeBackfill />
      </div>
      {preferences && !preferences.enabled && (
        <p className="mx-auto max-w-6xl rounded-xl border border-[#e4ddce] bg-[#f7f3e9] px-4 py-3 text-xs leading-relaxed text-[#655d4c]">
          Library analysis is paused. Search can still show saved items, but Aside won’t prepare answers or analyze new saves until you opt in.
        </p>
      )}

      {!query && !hasSubmitted && (
        <section className="mx-auto max-w-3xl space-y-6 pt-1">
          {recentSearches.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64716a]">Recently asked</h2>
                <button type="button" onClick={() => { localStorage.removeItem(RECENT_SEARCHES_KEY); setRecentSearches([]); }} className="min-h-9 px-2 text-xs font-medium text-[#8b593d] hover:underline">Clear history</button>
              </div>
              <div className="flex flex-wrap gap-2">{recentSearches.map((recent) => <button key={recent} type="button" onClick={() => selectRecent(recent)} className="min-h-10 rounded-full border border-[#e1d7ca] bg-[#fffdf9] px-4 text-sm text-[#465462] transition-colors hover:bg-[#f1efe7]">{recent}</button>)}</div>
            </div>
          )}
          <div className="rounded-2xl border border-dashed border-[#d9d4c8] bg-[#f8f6ef] px-5 py-6 text-center">
            <Search className="mx-auto h-8 w-8 text-[#84917c]" />
            <p className="mt-2 text-sm text-[#58665f]">Start with a question, a person, or a subject.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => selectRecent(suggestion)} className="min-h-9 rounded-full border border-[#ddd8ca] bg-[#fffdf9] px-3 text-xs text-[#58665f] hover:border-[#9eae96] hover:text-[#344d38]">{suggestion}</button>)}</div>
          </div>
        </section>
      )}

      {hasSubmitted && (
        <section className="mx-auto max-w-6xl space-y-4" aria-live="polite">
          {loading ? (
            <div className="mx-auto max-w-3xl space-y-4" aria-label="Searching your library">
              <div className="h-24 animate-pulse rounded-2xl border border-[#e2d6c8] bg-[#f3efe6]" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((key) => <div key={key} className="h-48 animate-pulse rounded-2xl bg-[#eee9df]" />)}</div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-[#e8c9bd] bg-[#fff8f3] px-5 py-10 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-[#ae654c]" />
              <p className="mt-3 font-medium text-[#62493e]">Search couldn't finish</p>
              <p className="mt-1 text-sm text-[#7b6257]">{error}</p>
              <button onClick={() => void submitSearch()} className="mt-4 min-h-10 rounded-full bg-[#526650] px-5 text-sm font-medium text-white">Try again</button>
            </div>
          ) : response ? (
            <div className="space-y-4">
              {response.answerStatus === "ready" && response.aiSummary?.trim() && <Summary text={response.aiSummary} />}
              {response.answerStatus === "disabled" && <p className="mx-auto max-w-3xl rounded-xl bg-[#f4f0e5] px-4 py-3 text-sm text-[#655d4c]">Answers are paused. Turn on “Answer from my saves” above to let Aside prepare answers; existing extracts are preserved.</p>}
              {response.answerStatus === "unavailable" && <p className="mx-auto max-w-3xl rounded-xl bg-[#f4f0e5] px-4 py-3 text-sm text-[#655d4c]">A generated answer isn't available for this search. Your saved items below are still searchable.</p>}
              {response.answerStatus === "insufficient" && !response.aiSummary && <p className="mx-auto max-w-3xl rounded-xl bg-[#f4f0e5] px-4 py-3 text-sm text-[#655d4c]">There isn't enough indexed source material for a reliable answer yet. Try a different phrase or check the coverage below.</p>}
              <div className="mx-auto max-w-6xl space-y-3">
                <Coverage response={response} />
                <p className="text-[11px] text-[#78817b]">
                  Applied filters: {response.filters.boardId ? (scopes.find((scope) => scope.id === response.filters.boardId)?.name ?? "selected board") : "My saves"}
                  {response.filters.from ? ` · from ${response.filters.from}` : ""}
                  {response.filters.to ? ` · through ${response.filters.to}` : ""}
                  {response.filters.tags.length ? ` · tags: ${response.filters.tags.join(", ")}` : ""}
                </p>
                {response.warnings.map((warning, index) => <p key={`${index}-${warning}`} className="rounded-lg border border-[#e8dfcf] bg-[#fffaf0] px-3 py-2 text-xs text-[#74654d]">{warning}</p>)}
                <p className="text-sm text-[#68746d]"><strong className="text-[#334450]">{response.messages.length}</strong> saves · {response.searchMethod === "hybrid" ? "meaning + keyword search" : "keyword search"}</p>
                <div>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#69756b]">Sources in your library</h2>
                  {citations.length > 0 ? (
                    <ol className="grid gap-2 sm:grid-cols-2">
                      {citations.map((citation) => (
                        <li key={citation.id}>
                          <a href={`#save-${citation.messageId}`} onClick={() => {
                            if (!response.messages.some((message) => message.id === citation.messageId) || inspectedCitationsRef.current.has(citation.id)) return;
                            inspectedCitationsRef.current.add(citation.id);
                            trackKnowledgeCitation(citation.kind);
                          }} className="block min-h-12 rounded-xl border border-[#e1d7ca] bg-[#fffdf9] p-3 transition-colors hover:border-[#a7b49e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526650]">
                            <span className="flex items-start justify-between gap-3"><span className="text-xs font-semibold text-[#344851]">{citation.title || "Saved source"}</span><span className="shrink-0 rounded-full bg-[#edf1e9] px-2 py-0.5 text-[10px] text-[#526650]">{citation.kind}</span></span>
                            <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-[#68746d]">{citation.excerpt || "Open this saved item to review its source."}</span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  ) : <p className="text-xs text-[#79817b]">No source citations were returned.</p>}
                </div>
              </div>
              {response.messages.length > 0 ? (
                <Masonry breakpointCols={BREAKPOINT_COLUMNS} className="masonry-grid" columnClassName="masonry-grid_column">
                  {response.messages.map((message) => <div key={message.id} className="mb-4 scroll-mt-6"><MessageCard message={message} /></div>)}
                </Masonry>
              ) : (
                <div className="py-10 text-center">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#efede5]"><SearchX className="h-7 w-7 text-[#738071]" /></span>
                  <p className="mt-3 font-medium text-[#4a5962]">No matching saves found</p>
                  <p className="mt-1 text-sm text-[#78817d]">Try another phrase or broaden your dates.</p>
                </div>
              )}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
