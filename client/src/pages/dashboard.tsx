import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Folder, User, Users, Plus, Edit, UserPlus, Trash2, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { RenameBoardModal } from "@/components/shared-boards/RenameBoardModal";
import { InviteUserModal } from "@/components/shared-boards/InviteUserModal";
import { BoardMembersModal } from "@/components/shared-boards/BoardMembersModal";
import { DeleteSharedBoardModal } from "@/components/shared-boards/DeleteSharedBoardModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    id?: number;
  };
}

function BoardCard({ board }: BoardCardProps) {
  const [, setLocation] = useLocation();
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleNavigate = () => {
    setLocation(board.href);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <Card 
        className={`${boardCardStyle} cursor-pointer`}
        data-pendo="dashboard-board-card"
        data-board-type={board.type}
        data-board-name={board.name}
        onClick={handleNavigate}
      >
        <CardContent className="p-6">
          {/* Mobile: horizontal layout, Desktop: vertical layout */}
          <div className="flex md:flex-col gap-4 md:gap-0 items-center md:items-start">
            {/* Left side content */}
            <div className="flex-1">
              {/* Folder Icon - Left Aligned */}
              <div className="mb-2.5">
                <Folder className="w-7 h-7 text-[#263d57]" />
              </div>
              
              {/* Board Name with Icon */}
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-semibold text-[#263d57] text-lg md:text-base">
                  #{board.name}
                </h3>
                {board.type === 'private' ? (
                  <User className="w-3.5 h-3.5 text-[#263d57]/40 flex-shrink-0 fill-none" />
                ) : (
                  <Users className="w-3.5 h-3.5 text-[#263d57]/40 flex-shrink-0 fill-none" />
                )}
              </div>
              
              {/* Save Count */}
              <div className="mb-3 md:mb-3">
                <span className="text-sm text-[#263d57]/50">
                  {board.count} {board.count === 1 ? 'save' : 'saves'}
                </span>
              </div>

              {/* Horizontal Divider - Desktop only */}
              <div className="hidden md:block border-t border-[#263d57]/10 mb-3"></div>

              {/* Board Controls - Desktop horizontal */}
              <div className="hidden md:flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={handleNavigate}
                  className="text-[#263d57] hover:text-[#b95827] transition-colors"
                  data-testid={`button-add-card-${board.name}`}
                  data-pendo="board-card-add-btn"
                  data-board-name={board.name}
                  data-board-type={board.type}
                  title="Add Card"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setRenameModalOpen(true)}
                  className="text-[#263d57] hover:text-[#b95827] transition-colors"
                  data-testid={`button-rename-${board.name}`}
                  data-pendo="board-card-rename-btn"
                  data-board-name={board.name}
                  data-board-type={board.type}
                  title="Rename"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setInviteModalOpen(true)}
                  className="text-[#263d57] hover:text-[#b95827] transition-colors"
                  data-testid={`button-invite-${board.name}`}
                  data-pendo="board-card-invite-btn"
                  data-board-name={board.name}
                  data-board-type={board.type}
                  title="Invite"
                >
                  <UserPlus className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="text-red-600 hover:text-red-700 transition-colors"
                  data-testid={`button-delete-${board.name}`}
                  data-pendo="board-card-delete-btn"
                  data-board-name={board.name}
                  data-board-type={board.type}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Vertical Divider - Mobile only */}
            <div className="md:hidden border-l border-[#263d57]/20 self-stretch -ml-2.5"></div>

            {/* Board Controls - Mobile 2x2 grid */}
            <div className="md:hidden grid grid-cols-2 gap-5 content-center" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleNavigate}
                className="text-[#263d57] hover:text-[#b95827] transition-colors"
                data-testid={`button-add-card-${board.name}`}
                data-pendo="board-card-add-btn"
                data-board-name={board.name}
                data-board-type={board.type}
                title="Add Card"
              >
                <Plus className="w-5 h-5" />
              </button>

              <button
                onClick={() => setRenameModalOpen(true)}
                className="text-[#263d57] hover:text-[#b95827] transition-colors"
                data-testid={`button-rename-${board.name}`}
                data-pendo="board-card-rename-btn"
                data-board-name={board.name}
                data-board-type={board.type}
                title="Rename"
              >
                <Edit className="w-5 h-5" />
              </button>

              <button
                onClick={() => setInviteModalOpen(true)}
                className="text-[#263d57] hover:text-[#b95827] transition-colors"
                data-testid={`button-invite-${board.name}`}
                data-pendo="board-card-invite-btn"
                data-board-name={board.name}
                data-board-type={board.type}
                title="Invite"
              >
                <UserPlus className="w-5 h-5" />
              </button>

              <button
                onClick={() => setDeleteModalOpen(true)}
                className="text-red-600 hover:text-red-700 transition-colors"
                data-testid={`button-delete-${board.name}`}
                data-pendo="board-card-delete-btn"
                data-board-name={board.name}
                data-board-type={board.type}
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <RenameBoardModal
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        boardType={board.type}
        currentName={board.name}
        boardId={board.id}
      />

      <InviteUserModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        boardName={board.name}
      />

      <BoardMembersModal
        isOpen={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        boardName={board.name}
      />

      {board.type === 'shared' && board.role === 'owner' && board.id && (
        <DeleteSharedBoardModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          boardName={board.name}
          boardId={board.id}
        />
      )}
    </>
  );
}

export default function Dashboard() {
  const { profile } = useProfile();
  const [sortOrder, setSortOrder] = useState<"a-z" | "z-a">("a-z");
  
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

  const unsortedBoards = [
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
      count: board.count,
      id: board.id
    })) || [])
  ];

  // Apply sorting
  const allBoards = [...unsortedBoards].sort((a, b) => {
    if (sortOrder === "a-z") {
      return a.name.localeCompare(b.name);
    } else {
      return b.name.localeCompare(a.name);
    }
  });

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
      {/* Page title and sort controls */}
      <div className="h-[100px] flex flex-col justify-center">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-2xl font-bold text-[#263d57]">
            All Boards
          </h2>
          
          {allBoards.length > 0 && (
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-[#263d57]/60" />
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "a-z" | "z-a")}>
                <SelectTrigger className="w-[160px] bg-white border-[#e3cac0] focus:border-[#b95827]" data-testid="select-sort-boards">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem 
                    value="a-z"
                    data-pendo="all-boards-sort-option"
                    data-sort-type="alphabetical"
                  >
                    A to Z
                  </SelectItem>
                  <SelectItem 
                    value="z-a"
                    data-pendo="all-boards-sort-option"
                    data-sort-type="alphabetical-reverse"
                  >
                    Z to A
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        {/* Divider */}
        <div className="w-full h-px bg-[#e3cac0] mt-4"></div>
      </div>

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