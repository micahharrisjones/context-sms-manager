import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Hash, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [location] = useLocation();
  const { data: tags } = useQuery<string[]>({ 
    queryKey: ["/api/tags"]
  });

  return (
    <div className="w-full lg:w-64 h-full bg-background border-r">
      <div className="p-6 border-b flex justify-between items-center">
        <Link href="/">
          <div className="flex items-center gap-2">
            <Logo className="w-auto h-6 lg:h-8" />
          </div>
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="p-4">
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
      <ScrollArea className="h-[calc(100vh-180px)]">
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