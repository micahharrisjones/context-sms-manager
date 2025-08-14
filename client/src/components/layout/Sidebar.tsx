import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Hash, X, Users, Plus, UserPlus, Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { useState } from "react";
import { DeleteTagModal } from "./DeleteTagModal";
import { CreateSharedBoardModal } from "../shared-boards/CreateSharedBoardModal";
import { InviteUserModal } from "../shared-boards/InviteUserModal";
import { BoardMembersModal } from "../shared-boards/BoardMembersModal";
import { DeleteSharedBoardModal } from "../shared-boards/DeleteSharedBoardModal";
import { SharedBoard } from "@shared/schema";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [location] = useLocation();
  const [deleteTagModalOpen, setDeleteTagModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [createBoardModalOpen, setCreateBoardModalOpen] = useState(false);
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
    <div className="w-full lg:w-64 h-full bg-background border-r">
      <div className="p-6 border-b flex justify-between items-center lg:hidden">
        <Link href="/">
          <div className="flex items-center gap-2">
            <Logo className="w-auto h-8" />
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
        
        {/* Shared Boards Section */}
        <div className="px-4 py-2">
          <div className="border-t border-border mb-4"></div>
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Shared Boards
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              onClick={() => setCreateBoardModalOpen(true)}
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
                      location === `/shared/${board.name}` && "bg-muted"
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
      </ScrollArea>
      
      <DeleteTagModal
        isOpen={deleteTagModalOpen}
        onClose={() => setDeleteTagModalOpen(false)}
        tag={selectedTag}
      />
      
      <CreateSharedBoardModal
        isOpen={createBoardModalOpen}
        onClose={() => setCreateBoardModalOpen(false)}
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