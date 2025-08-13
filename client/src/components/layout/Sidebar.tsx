import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Hash, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { useState } from "react";
import { DeleteTagModal } from "./DeleteTagModal";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [location] = useLocation();
  const [deleteTagModalOpen, setDeleteTagModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>("");
  
  const { data: tags } = useQuery<string[]>({ 
    queryKey: ["/api/tags"]
  });

  const handleDeleteTag = (tag: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTag(tag);
    setDeleteTagModalOpen(true);
  };

  return (
    <div className="w-full lg:w-64 h-full bg-background border-r">
      <div className="p-6 border-b flex justify-between items-center">
        <Link href="/">
          <div className="flex items-center gap-2">
            <Logo className="w-auto h-8 lg:h-10" />
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
        <div className={cn(
          "border rounded-lg transition-colors",
          location === "/" 
            ? "border-primary/20 bg-primary/5" 
            : "border-border bg-muted/30"
        )}>
          <Link href="/">
            <Button 
              variant="ghost" 
              className={cn(
                "w-full justify-start m-1 hover:bg-transparent",
                location === "/" 
                  ? "bg-transparent text-primary font-medium" 
                  : "hover:bg-muted/50"
              )}
              size="lg"
              onClick={onClose}
            >
              All Texts
            </Button>
          </Link>
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="p-4 space-y-2">
          {tags?.map((tag) => (
            <div key={tag} className="relative group">
              <Link href={`/tag/${tag}`}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start pr-8",
                    location === `/tag/${tag}` && "bg-muted"
                  )}
                  onClick={onClose}
                >
                  <Hash className="w-4 h-4 mr-2" />
                  {tag}
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleDeleteTag(tag, e)}
                className="absolute right-1 top-1 bottom-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-auto w-6 p-0 hover:bg-red-50 hover:text-red-600"
                aria-label={`Delete tag ${tag}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <DeleteTagModal
        isOpen={deleteTagModalOpen}
        onClose={() => setDeleteTagModalOpen(false)}
        tag={selectedTag}
      />
    </div>
  );
}