import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { MessageList } from "@/components/messages/MessageList";
import type { Message } from "@shared/schema";
import { pendo } from "@/lib/pendo";

interface Tag {
  tag: string;
  count: number;
}

interface SharedBoard {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
  role: "owner" | "member";
  count: number;
}

interface BoardsData {
  privateTags: Tag[];
  sharedBoards: SharedBoard[];
}

// Consistent styling for all board cards
const boardCardStyle = "bg-[#fff2ea] shadow-md hover:shadow-lg hover:bg-[#e3cac0] transition-all duration-200";

export default function Dashboard() {
  const { profile } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [visibleResults, setVisibleResults] = useState(3);
  
  // Reset visible results when search query changes
  useEffect(() => {
    setVisibleResults(3);
  }, [debouncedQuery]);
  
  // Debounce search query and track analytics
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() && searchQuery !== debouncedQuery) {
        // Track search query
        pendo.track("Hybrid_Search_Query_Submitted", {
          query: searchQuery,
          queryLength: searchQuery.length,
          source: "homescreen",
        });
      }
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedQuery]);
  
  // Get private tags with counts
  const { data: tagsWithCounts, isLoading: tagsLoading, error: tagsError } = useQuery<Tag[]>({
    queryKey: ["/api/tags-with-counts"],
    retry: false,
  });

  // Get shared boards with counts
  const { data: sharedBoards, isLoading: sharedLoading, error: sharedError } = useQuery<SharedBoard[]>({
    queryKey: ["/api/shared-boards-with-counts"],
    retry: false,
  });

  // Hybrid search query
  const { data: searchResults, isLoading: searchLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages/hybrid-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const response = await fetch(`/api/messages/hybrid-search?q=${encodeURIComponent(debouncedQuery)}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    enabled: !!debouncedQuery.trim(),
  });

  // Track search results analytics
  useEffect(() => {
    if (searchResults && debouncedQuery.trim()) {
      pendo.track("Hybrid_Search_Results_Displayed", {
        query: debouncedQuery,
        resultsCount: searchResults.length,
        hasResults: searchResults.length > 0,
        source: "homescreen",
      });
    }
  }, [searchResults, debouncedQuery]);

  const isLoading = tagsLoading || sharedLoading;
  
  const boardsData: BoardsData = {
    privateTags: tagsWithCounts || [],
    sharedBoards: sharedBoards || []
  };

  const firstName = profile?.firstName;
  const allBoards = [
    ...(boardsData?.privateTags.map(tag => ({ 
      name: tag.tag, 
      type: 'private' as const, 
      href: `/tag/private/${tag.tag}`,
      count: tag.count 
    })) || []),
    ...(boardsData?.sharedBoards.map(board => ({ 
      name: board.name, 
      type: 'shared' as const, 
      href: `/tag/shared/${board.name}`,
      role: board.role,
      count: board.count
    })) || [])
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-[#263d57]/10 rounded animate-pulse"></div>
        <div className="h-px bg-[#e3cac0]"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-[#263d57]/10 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Search Bar Hero */}
      <div className="py-8">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-light text-[#263d57] mb-4">
            {firstName ? `Hi ${firstName}, ` : ""}find anything you've saved
          </h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#263d57]/50" />
            <Input
              type="text"
              placeholder="Search by meaning, not just keywords... (e.g., 'recipes for dinner' or 'that article about AI')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-6 text-lg bg-white border-2 border-[#e3cac0] focus:border-[#b95827] focus:ring-0"
              data-pendo="input-homescreen-search"
            />
          </div>
        </div>
      </div>

      {/* Search Results or Boards Grid */}
      {debouncedQuery.trim() ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-[#263d57]">
              {searchLoading ? "Searching..." : `Results for "${debouncedQuery}"`}
            </h3>
            {searchResults && searchResults.length > 0 && (
              <span className="text-sm text-[#263d57]/70">{searchResults.length} found</span>
            )}
          </div>
          <div className="w-full h-px bg-[#e3cac0]"></div>
          {searchLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 bg-[#263d57]/10 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : searchResults && searchResults.length > 0 ? (
            <div className="space-y-6">
              <MessageList messages={searchResults.slice(0, visibleResults)} isLoading={false} />
              {searchResults.length > visibleResults && (
                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      const newCount = visibleResults + 10;
                      setVisibleResults(newCount);
                      pendo.track("Search_Load_More_Clicked", {
                        query: debouncedQuery,
                        previousCount: visibleResults,
                        newCount: Math.min(newCount, searchResults.length),
                        totalResults: searchResults.length,
                      });
                    }}
                    variant="outline"
                    className="border-[#b95827] text-[#b95827] hover:bg-[#b95827] hover:text-white transition-colors"
                    data-testid="button-keep-searching"
                  >
                    Keep Searching
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-[#263d57]/70">No results found for "{debouncedQuery}"</p>
              <p className="text-[#263d57]/50 text-sm mt-2">Try a different search or browse your boards below</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Divider */}
          <div className="w-full h-px bg-[#e3cac0]"></div>

          {/* Boards Grid */}
          {allBoards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allBoards.map((board) => (
                <Link 
                  key={`${board.type}-${board.name}`} 
                  href={board.href}
                  data-pendo="dashboard-board-card"
                  data-board-type={board.type}
                  data-board-name={board.name}
                >
                  <Card className={`cursor-pointer ${boardCardStyle}`}>
                    <CardContent className="p-6 relative flex items-center">
                      <div className="flex-1 space-y-2">
                        <h3 className="font-medium text-[#263d57] text-lg">
                          {board.type === 'private' ? `#${board.name}` : board.name}
                        </h3>
                        <div>
                          <span className="text-sm text-[#263d57]/70">
                            {board.type === 'private' ? 'Private Board' : 
                             board.type === 'shared' ? 
                               (board.role === 'owner' ? 'Shared Board (Owner)' : 'Shared Board') : ''}
                          </span>
                        </div>
                      </div>
                      {/* Large count number - vertically centered, right-aligned */}
                      <div className="ml-4">
                        <span className="text-6xl font-thin text-[#263d57]">
                          {'count' in board ? board.count : 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-[#263d57]/70 text-lg">No boards yet. Start by sending a message with a hashtag!</p>
              <p className="text-[#263d57]/50 text-sm mt-2">Text +1 (458) 218-8508 with #example to create your first board.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}