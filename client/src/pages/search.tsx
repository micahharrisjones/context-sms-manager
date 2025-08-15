import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageList } from "@/components/messages/MessageList";
import { Search } from "lucide-react";

export default function SearchPage() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const query = urlParams.get('q') || '';
  
  console.log(`SearchPage - Location: ${location}`);
  console.log(`SearchPage - Query: ${query}`);

  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ["/api/messages/search", query],
    queryFn: async () => {
      if (!query.trim()) {
        console.log("Search query is empty, returning empty array");
        return [];
      }
      
      console.log(`Making search request for: ${query}`);
      const response = await fetch(`/api/messages/search?q=${encodeURIComponent(query)}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      console.log(`Search response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Search failed: ${response.status} ${errorText}`);
        throw new Error(`Failed to search messages: ${response.status} ${errorText}`);
      }
      const results = await response.json();
      console.log(`Search results:`, results);
      return results;
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