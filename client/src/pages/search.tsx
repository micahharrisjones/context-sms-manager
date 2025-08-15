import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageList } from "@/components/messages/MessageList";
import { Search } from "lucide-react";

export default function SearchPage() {
  const [location] = useLocation();
  
  // Parse the query parameter from the URL
  // wouter's location includes the full path including query params
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get('q') || '';
  
  // Search functionality working correctly

  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ["/api/messages/search", query],
    queryFn: async () => {
      if (!query.trim()) return [];
      
      const response = await fetch(`/api/messages/search?q=${encodeURIComponent(query)}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to search messages: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    enabled: !!query.trim()
  });

  if (!query.trim()) {
    return (
      <div className="text-center py-12">
        <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Search Messages</h2>
        <p className="text-muted-foreground">
          Use the search bar in the sidebar to find messages across all your boards
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Search className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2 text-red-600">Search Error</h2>
        <p className="text-muted-foreground">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Search Results</h1>
        <p className="text-muted-foreground">
          Results for "{query}" {searchResults && `(${searchResults.length} found)`}
        </p>
      </div>
      
      <MessageList messages={searchResults} isLoading={isLoading} />
    </div>
  );
}