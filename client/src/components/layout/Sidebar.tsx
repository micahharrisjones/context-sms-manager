import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();
  const { data: tags } = useQuery<string[]>({ 
    queryKey: ["/api/tags"]
  });

  return (
    <div className="w-64 border-r h-screen">
      <div className="p-4 border-b">
        <Link href="/">
          <Button 
            variant="ghost" 
            className="w-full justify-start"
            size="lg"
          >
            All Messages
          </Button>
        </Link>
      </div>
      <ScrollArea className="h-[calc(100vh-65px)]">
        <div className="p-4 space-y-2">
          {tags?.map((tag) => (
            <Link key={tag} href={`/tag/${tag}`}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start",
                  location === `/tag/${tag}` && "bg-muted"
                )}
              >
                <Hash className="w-4 h-4 mr-2" />
                {tag}
              </Button>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
