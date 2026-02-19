import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, X, Sparkles, SearchX, Bot, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Message } from "@shared/schema";
import { MessageCard } from "@/components/messages/MessageCard";
import Masonry from "react-masonry-css";

const RECENT_SEARCHES_KEY = 'aside-recent-searches';
const MAX_RECENT = 5;

interface AISearchResponse {
  messages: Message[];
  aiSummary: string;
  searchMethod: string;
  query: string;
}

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const recent = getRecentSearches().filter((s) => s !== trimmed);
  recent.unshift(trimmed);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

const SUGGESTION_PILLS = [
  "what recipes have I saved?",
  "find links about AI",
  "show me my travel ideas",
  "what movies did I save?",
  "gift ideas",
];

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

function TypewriterText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const prevTextRef = useRef('');

  useEffect(() => {
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;
    setDisplayedText('');
    setIsComplete(false);

    if (!text) return;

    let index = 0;
    const interval = setInterval(() => {
      index++;
      setDisplayedText(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, 20);

    return () => clearInterval(interval);
  }, [text, onComplete]);

  return (
    <span>
      {displayedText}
      {!isComplete && <span className="inline-block w-0.5 h-4 bg-[#b95827] animate-pulse ml-0.5 align-text-bottom" />}
    </span>
  );
}

function AISummaryBubble({ summary }: { summary: string }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-[#e3cac0]/60">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#b95827]/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-[#b95827]" />
        </div>
        <div className="flex-1 pt-1">
          <p className="text-sm text-[#263d57] leading-relaxed">
            <TypewriterText text={summary} />
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches());
  const [submittedQuery, setSubmittedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 600);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q') || '';
    if (queryParam) {
      setSearchQuery(queryParam);
      setSubmittedQuery(queryParam);
    }
  }, []);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length > 0) {
      setSubmittedQuery(trimmed);
    } else {
      setSubmittedQuery('');
    }
  }, [debouncedQuery]);

  const { data: searchData, isLoading: searchLoading, isError } = useQuery<AISearchResponse>({
    queryKey: ['/api/ai-search', submittedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/ai-search?q=${encodeURIComponent(submittedQuery)}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: submittedQuery.length > 0,
    retry: false,
    staleTime: 30000,
  });

  const searchResults = searchData?.messages;
  const aiSummary = searchData?.aiSummary;

  useEffect(() => {
    if (searchData && submittedQuery) {
      saveRecentSearch(submittedQuery);
      setRecentSearches(getRecentSearches());
    }
  }, [searchData, submittedQuery]);

  const handleChipClick = useCallback((query: string) => {
    setSearchQuery(query);
    setSubmittedQuery(query);
  }, []);

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    setSubmittedQuery('');
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setSubmittedQuery(searchQuery.trim());
    }
  }, [searchQuery]);

  const breakpointColumnsObj = {
    default: 3,
    1100: 2,
    700: 1
  };

  const hasQuery = searchQuery.trim().length > 0;
  const hasSubmitted = submittedQuery.length > 0;
  const hasResults = searchResults && searchResults.length > 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div
        className={`transition-all duration-300 ease-in-out ${
          hasQuery
            ? "pt-2 pb-4 md:pt-4 md:pb-6"
            : "pt-8 pb-6 md:pt-16 md:pb-10"
        }`}
      >
        <div className="max-w-2xl mx-auto text-center">
          {!hasQuery && (
            <div className="mb-6 md:mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#b95827]/10 mb-4">
                <Sparkles className="w-7 h-7 text-[#b95827]" />
              </div>
              <h2 className="text-2xl md:text-3xl font-light text-[#263d57] mb-2">
                Ask Aside anything
              </h2>
              <p className="text-sm text-[#263d57]/50">
                Search naturally — ask questions, use keywords, or describe what you're looking for
              </p>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#263d57]/40" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Ask anything about your saved content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-13 pr-10 py-6 text-base md:text-lg bg-white border-2 border-[#e3cac0] rounded-full shadow-sm hover:shadow-md focus:shadow-md focus:border-[#b95827] focus:ring-0 transition-shadow duration-200"
              style={{ paddingLeft: '3.25rem' }}
              data-testid="input-search-page"
              data-pendo="input-search"
              autoFocus
            />
            {hasQuery && (
              <button
                onClick={handleClear}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-[#e3cac0]/40 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4 text-[#263d57]/50" />
              </button>
            )}
          </div>
        </div>
      </div>

      {!hasQuery && !hasSubmitted && (
        <div className="max-w-2xl mx-auto space-y-6">
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#263d57]/70 uppercase tracking-wider">
                  Recent Searches
                </h3>
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-[#b95827] hover:text-[#b95827]/80 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((query) => (
                  <button
                    key={query}
                    onClick={() => handleChipClick(query)}
                    className="px-4 py-2 rounded-full bg-[#e3cac0]/50 text-[#263d57] text-sm hover:bg-[#e3cac0]/80 transition-colors"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center pt-4">
            <Search className="w-10 h-10 text-[#263d57]/20 mx-auto mb-3" />
            <p className="text-[#263d57]/50 text-sm">
              Try asking questions or searching by topic
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {SUGGESTION_PILLS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleChipClick(suggestion)}
                  className="px-3 py-1.5 rounded-full border border-[#e3cac0] text-[#263d57]/60 text-xs hover:bg-[#e3cac0]/30 hover:text-[#263d57] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasSubmitted && (
        <div className="space-y-4 md:space-y-6">
          {searchLoading ? (
            <>
              <div className="max-w-2xl mx-auto">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-[#e3cac0]/60">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#b95827]/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-[#b95827]" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 text-sm text-[#263d57]/60">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#b95827]/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#b95827]/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#b95827]/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span>Searching your saved content...</span>
                    </div>
                  </div>
                </div>
              </div>
              <Masonry
                breakpointCols={breakpointColumnsObj}
                className="masonry-grid"
                columnClassName="masonry-grid_column"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="mb-4 rounded-xl overflow-hidden"
                  >
                    <div
                      className="bg-[#e3cac0]/30 animate-pulse"
                      style={{ height: `${100 + (i % 3) * 40}px` }}
                    />
                  </div>
                ))}
              </Masonry>
            </>
          ) : isError ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-[#263d57]/70 text-lg mb-1">
                Something went wrong
              </p>
              <p className="text-[#263d57]/50 text-sm mb-4">
                We couldn't complete your search. Please try again.
              </p>
              <button
                onClick={() => setSubmittedQuery(submittedQuery)}
                className="px-4 py-2 rounded-full bg-[#b95827] text-white text-sm hover:bg-[#b95827]/90 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : hasResults ? (
            <>
              {aiSummary && <AISummaryBubble summary={aiSummary} />}
              <p className="text-sm text-[#263d57]/60">
                <span className="font-medium text-[#263d57]">{searchResults.length}</span>{" "}
                {searchResults.length === 1 ? "result" : "results"} found
              </p>
              <Masonry
                breakpointCols={breakpointColumnsObj}
                className="masonry-grid"
                columnClassName="masonry-grid_column"
              >
                {searchResults.map((message) => (
                  <div key={message.id} className="mb-4">
                    <MessageCard message={message} />
                  </div>
                ))}
              </Masonry>
            </>
          ) : (
            <>
              {aiSummary ? (
                <AISummaryBubble summary={aiSummary} />
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#e3cac0]/30 mb-4">
                    <SearchX className="w-8 h-8 text-[#263d57]/40" />
                  </div>
                  <p className="text-[#263d57]/70 text-lg mb-1">
                    No results for "<span className="font-medium">{submittedQuery}</span>"
                  </p>
                  <p className="text-[#263d57]/50 text-sm mb-6">
                    Try different keywords or ask a different question
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTION_PILLS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleChipClick(suggestion)}
                        className="px-3 py-1.5 rounded-full border border-[#e3cac0] text-[#263d57]/60 text-xs hover:bg-[#e3cac0]/30 hover:text-[#263d57] transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
