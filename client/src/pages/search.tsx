import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, X, Sparkles, SearchX } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Message } from "@shared/schema";
import { MessageCard } from "@/components/messages/MessageCard";
import Masonry from "react-masonry-css";

const RECENT_SEARCHES_KEY = 'aside-recent-searches';
const MAX_RECENT = 5;

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
  "recipes for dinner",
  "that article about AI",
  "travel ideas",
  "book recommendations",
  "workout tips",
];

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches());

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q') || '';
    if (queryParam) {
      setSearchQuery(queryParam);
    }
  }, []);

  const { data: searchResults, isLoading: searchLoading } = useQuery<Message[]>({
    queryKey: [`/api/messages/hybrid-search?q=${encodeURIComponent(searchQuery.trim())}`],
    enabled: searchQuery.trim().length > 0,
    retry: false,
  });

  useEffect(() => {
    if (searchResults && searchResults.length >= 0 && searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
      setRecentSearches(getRecentSearches());
    }
  }, [searchResults]);

  const handleChipClick = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const breakpointColumnsObj = {
    default: 3,
    1100: 2,
    700: 1
  };

  const hasQuery = searchQuery.trim().length > 0;
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
                Search everything you've saved
              </h2>
              <p className="text-[#263d57]/60 text-sm md:text-base">
                Powered by meaning — not just exact keywords
              </p>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#263d57]/40" />
            <Input
              type="text"
              placeholder="Search by meaning, not just keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-13 pr-10 py-6 text-base md:text-lg bg-white border-2 border-[#e3cac0] rounded-full shadow-sm hover:shadow-md focus:shadow-md focus:border-[#b95827] focus:ring-0 transition-shadow duration-200"
              style={{ paddingLeft: '3.25rem' }}
              data-testid="input-search-page"
              data-pendo="input-search"
              autoFocus
            />
            {hasQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-[#e3cac0]/40 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4 text-[#263d57]/50" />
              </button>
            )}
          </div>
        </div>
      </div>

      {!hasQuery && (
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
              Try topics, keywords, or even questions
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

      {hasQuery && (
        <div className="space-y-4 md:space-y-6">
          <div className="max-w-2xl mx-auto">
            <div className="w-full h-px bg-[#e3cac0]" />
          </div>

          {searchLoading ? (
            <>
              <div className="flex items-center gap-2 text-sm text-[#263d57]/50">
                <div className="w-3 h-3 rounded-full bg-[#b95827]/40 animate-pulse" />
                Searching...
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
          ) : hasResults ? (
            <>
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
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#e3cac0]/30 mb-4">
                <SearchX className="w-8 h-8 text-[#263d57]/40" />
              </div>
              <p className="text-[#263d57]/70 text-lg mb-1">
                No results for "<span className="font-medium">{searchQuery}</span>"
              </p>
              <p className="text-[#263d57]/50 text-sm mb-6">
                Try searching for topics, keywords, or even questions
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
        </div>
      )}
    </div>
  );
}
