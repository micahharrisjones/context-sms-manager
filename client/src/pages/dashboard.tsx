import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

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
}

interface BoardsData {
  privateTags: Tag[];
  sharedBoards: SharedBoard[];
}

// Consistent styling for all board cards
const boardCardStyle = "bg-[#fff3ea] border border-black hover:bg-[#e3cac0] transition-colors duration-200";

export default function Dashboard() {
  const { profile } = useProfile();
  
  // Get private tags with counts
  const { data: tagsWithCounts, isLoading: tagsLoading, error: tagsError } = useQuery<Tag[]>({
    queryKey: ["/api/tags-with-counts"],
    retry: false,
  });

  // Get shared boards
  const { data: sharedBoards, isLoading: sharedLoading, error: sharedError } = useQuery<SharedBoard[]>({
    queryKey: ["/api/shared-boards"],
    retry: false,
  });

  // Debug logging - remove after testing
  // console.log("Dashboard data:", { tagsWithCounts, sharedBoards, tagsLoading, sharedLoading, tagsError, sharedError, profile });

  const isLoading = tagsLoading || sharedLoading;
  
  const boardsData: BoardsData = {
    privateTags: tagsWithCounts || [],
    sharedBoards: sharedBoards || []
  };

  // Generate daily affirmation
  const { data: affirmation, isLoading: affirmationLoading } = useQuery<{ text: string }>({
    queryKey: ["/api/affirmation", new Date().toDateString()], // Cache per day
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const firstName = profile?.firstName;
  const allBoards = [
    ...(boardsData?.privateTags.map(tag => ({ 
      name: tag.tag, 
      type: 'private' as const, 
      href: `/tag/${tag.tag}`,
      count: tag.count 
    })) || []),
    ...(boardsData?.sharedBoards.map(board => ({ 
      name: board.name, 
      type: 'shared' as const, 
      href: `/shared/${board.name}`,
      role: board.role,
      count: 0 // TODO: Add shared board counts if needed
    })) || [])
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-px bg-[#e3cac0]"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Message */}
      <div className="text-left py-8">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-light text-gray-800">
          {firstName ? (
            <>
              Hi {firstName}, {affirmationLoading ? "..." : (affirmation?.text || "welcome to your Context boards.")}
            </>
          ) : (
            <>Welcome to your Context boards.</>
          )}
        </h1>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-[#e3cac0]"></div>

      {/* Boards Grid */}
      {allBoards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allBoards.map((board) => (
            <Link key={`${board.type}-${board.name}`} href={board.href}>
              <Card className={`cursor-pointer ${boardCardStyle}`}>
                <CardContent className="p-6 relative flex items-center">
                  <div className="flex-1 space-y-2">
                    <h3 className="font-medium text-gray-800 text-lg">
                      {board.type === 'private' ? `#${board.name}` : board.name}
                    </h3>
                    <div>
                      <span className="text-sm text-gray-600">
                        {board.type === 'private' ? 'Private Board' : 
                         board.type === 'shared' ? 
                           (board.role === 'owner' ? 'Shared Board (Owner)' : 'Shared Board') : ''}
                      </span>
                    </div>
                  </div>
                  {/* Large count number - vertically centered, right-aligned */}
                  <div className="ml-4">
                    <span className="text-6xl font-thin text-gray-700">
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
          <p className="text-gray-500 text-lg">No boards yet. Start by sending a message with a hashtag!</p>
          <p className="text-gray-400 text-sm mt-2">Text +1 (458) 218-8508 with #example to create your first board.</p>
        </div>
      )}
    </div>
  );
}