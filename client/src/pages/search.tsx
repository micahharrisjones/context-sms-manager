import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, Search, SearchX, Sparkles, X } from "lucide-react";
import Masonry from "react-masonry-css";
import type { KnowledgePreferences, KnowledgeSearchResponse } from "@shared/knowledge";
import { apiRequest } from "@/lib/queryClient";
import { trackKnowledgeCitation, trackKnowledgeSearch } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { MessageCard } from "@/components/messages/MessageCard";
import { KnowledgePreferencesPanel } from "@/components/knowledge/KnowledgePreferencesPanel";

const RECENT_SEARCHES_KEY = "aside-recent-searches";
const MAX_RECENT = 5;

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

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches);
  const [response, setResponse] = useState<KnowledgeSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preferences, setPreferences] = useState<KnowledgePreferences | null>(null);
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

  async function submitSearch(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = query.trim().slice(0, 800);
    if (!trimmed) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    setResponse(null);
    setError("");
    setSubmittedQuery(trimmed);
    setLoading(true);

    const params = new URLSearchParams({ q: trimmed, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });

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
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#64717b]">Find the links, photos and notes you tucked away.</p>
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
              aria-describedby="search-reading-limit"
            />
            {query && <button type="button" onClick={clearQuery} className="absolute right-[6.7rem] top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#68746d] hover:bg-[#f0ede5]" aria-label="Clear search"><X className="h-4 w-4" /></button>}
            <button type="submit" disabled={!query.trim()} className="absolute right-2 top-1/2 inline-flex h-10 -translate-y-1/2 items-center gap-2 rounded-xl bg-[#526650] px-4 text-sm font-medium text-white transition-colors hover:bg-[#435842] disabled:cursor-not-allowed disabled:opacity-50">
              <Search className="h-4 w-4" /><span className="hidden sm:inline">{loading ? "Search again" : "Search"}</span>
            </button>
          </div>
          <p id="search-reading-limit" className="mt-2 text-left text-[11px] leading-relaxed text-[#7c847e]">Private, paywalled and blocked pages may not be readable.</p>
        </form>
      </header>

      <div className="mx-auto max-w-3xl">
        <KnowledgePreferencesPanel onSettingsChange={handlePreferencesChange} />
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
              {response.answerStatus === "disabled" && <p className="mx-auto max-w-3xl rounded-xl bg-[#f4f0e5] px-4 py-3 text-sm text-[#655d4c]">Library answers are paused. Search can still show matching saved items.</p>}
              {response.answerStatus === "unavailable" && <p className="mx-auto max-w-3xl rounded-xl bg-[#f4f0e5] px-4 py-3 text-sm text-[#655d4c]">A generated answer isn't available for this search. Your saved items below are still searchable.</p>}
              {response.answerStatus === "insufficient" && !response.aiSummary && <p className="mx-auto max-w-3xl rounded-xl bg-[#f4f0e5] px-4 py-3 text-sm text-[#655d4c]">There isn't enough indexed source material for a reliable answer yet. Try a different phrase.</p>}
              <div className="mx-auto max-w-6xl space-y-3">
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
                  <p className="mt-1 text-sm text-[#78817d]">Try another phrase.</p>
                </div>
              )}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
