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

// Color palette for board cards
const boardColors = [
  "bg-gradient-to-br from-rose-100 to-pink-100 border-rose-200 hover:from-rose-200 hover:to-pink-200",
  "bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-200 hover:from-blue-200 hover:to-indigo-200", 
  "bg-gradient-to-br from-green-100 to-emerald-100 border-green-200 hover:from-green-200 hover:to-emerald-200",
  "bg-gradient-to-br from-purple-100 to-violet-100 border-purple-200 hover:from-purple-200 hover:to-violet-200",
  "bg-gradient-to-br from-yellow-100 to-amber-100 border-yellow-200 hover:from-yellow-200 hover:to-amber-200",
  "bg-gradient-to-br from-orange-100 to-red-100 border-orange-200 hover:from-orange-200 hover:to-red-200",
  "bg-gradient-to-br from-teal-100 to-cyan-100 border-teal-200 hover:from-teal-200 hover:to-cyan-200",
  "bg-gradient-to-br from-slate-100 to-gray-100 border-slate-200 hover:from-slate-200 hover:to-gray-200"
];

function getColorForBoard(index: number): string {
  return boardColors[index % boardColors.length];
}

export default function Dashboard() {
  const { profile } = useProfile();
  
  const { data: boardsData, isLoading } = useQuery<BoardsData>({
    queryKey: ["/api/tags"],
    select: (data: any) => {
      // Split the response into private tags and shared boards
      const privateTags: Tag[] = [];
      const sharedBoards: SharedBoard[] = [];
      
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (typeof item === 'string') {
            // It's a private tag
            privateTags.push({ tag: item, count: 0 });
          } else if (item.id && item.name) {
            // It's a shared board
            sharedBoards.push(item);
          }
        });
      }
      
      return { privateTags, sharedBoards };
    },
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
      role: board.role 
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
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-light text-gray-800">
          {firstName ? `Hi ${firstName}, welcome to your Context boards.` : "Welcome to your Context boards."}
        </h1>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-[#e3cac0]"></div>

      {/* Boards Grid */}
      {allBoards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allBoards.map((board, index) => (
            <Link key={`${board.type}-${board.name}`} href={board.href}>
              <Card className={`cursor-pointer transition-all duration-200 ${getColorForBoard(index)}`}>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-800 text-lg">
                      {board.type === 'private' ? `#${board.name}` : board.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {board.type === 'private' ? 'Private Board' : 
                         board.type === 'shared' ? 
                           (board.role === 'owner' ? 'Shared Board (Owner)' : 'Shared Board') : ''}
                      </span>
                      {board.type === 'private' && 'count' in board && board.count > 0 && (
                        <span className="text-xs bg-white/80 px-2 py-1 rounded-full text-gray-600">
                          {board.count}
                        </span>
                      )}
                    </div>
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