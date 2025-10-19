import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import { Message } from "@shared/schema";
import { MessageCard } from "@/components/messages/MessageCard";
import Masonry from "react-masonry-css";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Search functionality - only query when there's a search term
  const { data: searchResults, isLoading: searchLoading } = useQuery<Message[]>({
    queryKey: [`/api/messages/hybrid-search?q=${encodeURIComponent(searchQuery.trim())}`],
    enabled: searchQuery.trim().length > 0,
    retry: false,
  });

  const breakpointColumnsObj = {
    default: 3,
    1100: 2,
    700: 1
  };

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="py-8">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-light text-[#263d57] mb-4">
            Search everything you've saved
          </h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#263d57]/50" />
            <Input
              type="text"
              placeholder="Search by meaning, not just keywords... (e.g., 'recipes for dinner' or 'that article about AI')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-6 text-lg bg-white border-2 border-[#e3cac0] focus:border-[#b95827] focus:ring-0"
              data-testid="input-search-page"
              autoFocus
            />
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.trim().length > 0 ? (
        <div className="space-y-6">
          <div className="h-[100px] flex flex-col justify-center">
            <h2 className="text-2xl font-bold text-[#263d57]">
              Search Results
            </h2>
            <div className="w-full h-px bg-[#e3cac0] mt-4"></div>
          </div>

          {searchLoading ? (
            <Masonry
              breakpointCols={breakpointColumnsObj}
              className="masonry-grid"
              columnClassName="masonry-grid_column"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 bg-[#263d57]/10 rounded-lg animate-pulse mb-4"></div>
              ))}
            </Masonry>
          ) : searchResults && searchResults.length > 0 ? (
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
          ) : (
            <div className="text-center py-12">
              <p className="text-[#263d57]/70 text-lg">No results found for "{searchQuery}"</p>
              <p className="text-[#263d57]/50 text-sm mt-2">Try different keywords or search by topic</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-[#263d57]/30 mx-auto mb-4" />
          <p className="text-[#263d57]/70 text-lg">Start typing to search your messages</p>
          <p className="text-[#263d57]/50 text-sm mt-2">Search works by meaning, not just exact keywords</p>
        </div>
      )}
    </div>
  );
}
