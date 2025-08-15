import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  onClose?: () => void;
}

export function SearchBar({ onClose }: SearchBarProps) {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const trimmedQuery = searchQuery.trim();
      const searchUrl = `/search?q=${encodeURIComponent(trimmedQuery)}`;
      console.log(`Navigating to search with query: "${trimmedQuery}"`);
      console.log(`Search URL: ${searchUrl}`);
      navigate(searchUrl);
      onClose?.();
    } else {
      console.log("Search query is empty, not navigating");
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsExpanded(false);
  };

  return (
    <div className="relative">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className={cn(
          "relative transition-all duration-200",
          isExpanded ? "w-full" : "w-auto"
        )}>
          {!isExpanded ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </Button>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search all messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
                autoFocus
                onBlur={() => {
                  if (!searchQuery) {
                    setIsExpanded(false);
                  }
                }}
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
        {isExpanded && (
          <Button type="submit" size="sm" disabled={!searchQuery.trim()}>
            Search
          </Button>
        )}
      </form>
    </div>
  );
}