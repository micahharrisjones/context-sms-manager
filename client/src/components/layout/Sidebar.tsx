import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Hash, X, Users, User, Plus, UserPlus, Eye, Trash2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { SearchBar } from "./SearchBar";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { DeleteTagModal } from "./DeleteTagModal";
import { CreateSharedBoardModal } from "../shared-boards/CreateSharedBoardModal";
import { CreatePrivateBoardModal } from "../shared-boards/CreatePrivateBoardModal";
import { InviteUserModal } from "../shared-boards/InviteUserModal";
import { BoardMembersModal } from "../shared-boards/BoardMembersModal";
import { DeleteSharedBoardModal } from "../shared-boards/DeleteSharedBoardModal";
import { SharedBoard } from "@shared/schema";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [deleteTagModalOpen, setDeleteTagModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [createBoardModalOpen, setCreateBoardModalOpen] = useState(false);
  const [createPrivateBoardModalOpen, setCreatePrivateBoardModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [deleteBoardModalOpen, setDeleteBoardModalOpen] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [selectedBoardId, setSelectedBoardId] = useState<number>(0);
  
  const { data: tags } = useQuery<string[]>({ 
    queryKey: ["/api/tags"]
  });

  const { data: sharedBoards } = useQuery<(SharedBoard & { role: string })[]>({ 
    queryKey: ["/api/shared-boards"]
  });

  const handleDeleteTag = (tag: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTag(tag);
    setDeleteTagModalOpen(true);
  };

  return (
    <div className="w-full lg:w-64 h-full bg-[#fff3ea] border-r border-[#e3cac0] flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-[#e3cac0] flex justify-between items-center">
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4">
          {/* All Texts Button */}
          <div className={cn(
            "border border-[#e3cac0] rounded-lg transition-colors",
            location === "/" 
              ? "border-primary/20 bg-primary/5" 
              : "border-[#e3cac0] bg-[#e3cac0]/10"
          )}>
            <Link href="/">
              <Button 
                variant="ghost" 
                className={cn(
                  "w-full justify-start m-1",
                  location === "/" 
                    ? "bg-transparent text-primary font-medium hover:bg-transparent" 
                    : "hover:bg-[#e3cac0]/30"
                )}
                size="lg"
                onClick={onClose}
              >
                All Texts
              </Button>
            </Link>
          </div>
        </div>
      {/* Scrollable Tags and Shared Boards */}
      <ScrollArea className="flex-1 min-h-0">
        {/* Private Boards Section */}
        <div className="px-4 pt-2 pb-0">
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Private Boards
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-[#e3cac0]/30"
              onClick={() => setCreatePrivateBoardModalOpen(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="px-4 pb-4 space-y-2">
          {tags?.map((tag) => (
            <div key={tag} className="relative group">
              <Link href={`/tag/${tag}`}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start pr-8",
                    location === `/tag/${tag}` && "bg-[#e3cac0]/30"
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
        
        {/* Shared Boards Section */}
        <div className="px-4 py-2">
          <div className="border-t border-[#e3cac0] mb-4"></div>
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Shared Boards
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-[#e3cac0]/30"
              onClick={() => setCreatePrivateBoardModalOpen(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {sharedBoards && sharedBoards.length > 0 && (
          <div className="px-4 space-y-2">
            {sharedBoards.map((board) => (
              <div key={board.id} className="relative group">
                <Link href={`/shared/${board.name}`}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start pr-16",
                      location === `/shared/${board.name}` && "bg-[#e3cac0]/30"
                    )}
                    onClick={onClose}
                  >
                    <Hash className="w-4 h-4 mr-2" />
                    {board.name}
                    {board.role === "owner" && (
                      <span className="ml-auto mr-8 text-xs text-muted-foreground">owner</span>
                    )}
                  </Button>
                </Link>
                <div className="absolute right-1 top-1 bottom-1 flex opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedBoard(board.name);
                      setMembersModalOpen(true);
                    }}
                    className="h-auto w-6 p-0 hover:bg-green-50 hover:text-green-600 mr-1"
                    aria-label={`View members of ${board.name}`}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  {board.role === "owner" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedBoard(board.name);
                          setInviteModalOpen(true);
                        }}
                        className="h-auto w-6 p-0 hover:bg-blue-50 hover:text-blue-600 mr-1"
                        aria-label={`Invite users to ${board.name}`}
                      >
                        <UserPlus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedBoard(board.name);
                          setSelectedBoardId(board.id);
                          setDeleteBoardModalOpen(true);
                        }}
                        className="h-auto w-6 p-0 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete board ${board.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {sharedBoards && sharedBoards.length === 0 && (
          <div className="px-4 text-xs text-muted-foreground">
            No shared boards yet. Click + to create one.
          </div>
        )}

        {/* Search and Logout Section - Inside ScrollArea */}
        <div className="px-4 py-4 space-y-3">
          <div className="border-t border-[#e3cac0] mb-4"></div>
          
          {/* Search Bar */}
          <SearchBar onClose={onClose} />
          
          {/* Separator Line */}
          <div className="border-t border-[#e3cac0]"></div>
          
          {/* Logout Button */}
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-[#e3cac0]/20"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </ScrollArea>
      </div>
      
      <DeleteTagModal
        isOpen={deleteTagModalOpen}
        onClose={() => setDeleteTagModalOpen(false)}
        tag={selectedTag}
      />
      
      <CreateSharedBoardModal
        isOpen={createBoardModalOpen}
        onClose={() => setCreateBoardModalOpen(false)}
      />
      
      <CreatePrivateBoardModal
        isOpen={createPrivateBoardModalOpen}
        onClose={() => setCreatePrivateBoardModalOpen(false)}
      />
      
      <InviteUserModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        boardName={selectedBoard}
      />
      
      <BoardMembersModal
        isOpen={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        boardName={selectedBoard}
      />
      
      <DeleteSharedBoardModal
        isOpen={deleteBoardModalOpen}
        onClose={() => setDeleteBoardModalOpen(false)}
        boardName={selectedBoard}
        boardId={selectedBoardId}
      />
    </div>
  );
}