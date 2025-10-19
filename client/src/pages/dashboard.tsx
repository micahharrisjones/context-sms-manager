import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { BoardIcon } from "@/components/boards/BoardIcon";
import { Lock, Users, ArrowRight } from "lucide-react";

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

// Consistent styling for all board cards - white background
const boardCardStyle = "bg-white shadow-md hover:shadow-lg hover:bg-white transition-all duration-200";

interface BoardCardProps {
  board: {
    name: string;
    type: 'private' | 'shared';
    href: string;
    count: number;
    role?: 'owner' | 'member';
  };
}

function BoardCard({ board }: BoardCardProps) {
  const [, setLocation] = useLocation();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLocation(board.href);
  };

  return (
    <Card 
      className={boardCardStyle}
      data-pendo="dashboard-board-card"
      data-board-type={board.type}
      data-board-name={board.name}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        {/* AI-Generated Abstract Icon - Left Aligned */}
        <div className="mb-2.5">
          <BoardIcon boardName={board.name} size={48} />
        </div>
        
        {/* Board Name with Icon */}
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-[#263d57] text-base">
            {board.type === 'private' ? `#${board.name}` : board.name}
          </h3>
          {board.type === 'private' ? (
            <Lock className="w-3.5 h-3.5 text-[#263d57]/40 flex-shrink-0" />
          ) : (
            <Users className="w-3.5 h-3.5 text-[#263d57]/40 flex-shrink-0" />
          )}
        </div>
        
        {/* Save Count */}
        <div>
          <span className="text-sm text-[#263d57]/50">
            {board.count} {board.count === 1 ? 'save' : 'saves'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { profile } = useProfile();
  
  // Get private tags with counts
  const { data: tagsWithCounts, isLoading: tagsLoading } = useQuery<Tag[]>({
    queryKey: ["/api/tags-with-counts"],
    retry: false,
  });

  // Get shared boards with counts
  const { data: sharedBoards, isLoading: sharedLoading } = useQuery<SharedBoard[]>({
    queryKey: ["/api/shared-boards-with-counts"],
    retry: false,
  });

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
      {/* SEARCH FUNCTIONALITY TEMPORARILY HIDDEN - TO BE REBUILT */}
      {/* 
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
      */}

      {/* Page title */}
      <div className="py-4">
        <h2 className="text-2xl font-bold text-[#263d57]">
          All Boards
        </h2>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-[#e3cac0]"></div>

      {/* Boards Grid */}
      {allBoards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allBoards.map((board) => (
            <BoardCard
              key={`${board.type}-${board.name}`}
              board={board}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-[#263d57]/70 text-lg">No boards yet. Start by sending a message with a hashtag!</p>
          <p className="text-[#663d57]/50 text-sm mt-2">Text +1 (458) 218-8508 with #example to create your first board.</p>
        </div>
      )}
    </div>
  );
}