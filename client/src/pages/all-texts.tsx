import { MessageList } from "@/components/messages/MessageList";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Edit, UserPlus, X, Eye, Trash2, Plus, ArrowUpDown, User, Users } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { DeleteTagModal } from "@/components/layout/DeleteTagModal";
import { InviteUserModal } from "@/components/shared-boards/InviteUserModal";
import { InviteToPrivateBoardModal } from "@/components/shared-boards/InviteToPrivateBoardModal";
import { BoardMembersModal } from "@/components/shared-boards/BoardMembersModal";
import { DeleteSharedBoardModal } from "@/components/shared-boards/DeleteSharedBoardModal";
import { RenameBoardModal } from "@/components/shared-boards/RenameBoardModal";
import { AddMessageModal } from "@/components/messages/AddMessageModal";
import { SharedBoard, Message } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AllTexts() {
  const params = useParams();
  const tag = params.tag;
  const boardName = params.boardName;
  const currentTagRef = useRef<string>("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "a-z" | "z-a">("newest");
  
  // Keep ref updated with current tag
  useEffect(() => {
    currentTagRef.current = tag || boardName || "uncategorized";
  }, [tag, boardName]);

  const [deleteTagModalOpen, setDeleteTagModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteToPrivateBoardModalOpen, setInviteToPrivateBoardModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [deleteBoardModalOpen, setDeleteBoardModalOpen] = useState(false);
  const [renameBoardModalOpen, setRenameBoardModalOpen] = useState(false);
  const [renameBoardType, setRenameBoardType] = useState<"shared" | "private">("shared");
  const [addMessageModalOpen, setAddMessageModalOpen] = useState(false);
  const [modalCurrentTag, setModalCurrentTag] = useState<string>("");

  // Fetch shared boards to get role information
  const { data: sharedBoards } = useQuery<(SharedBoard & { role: string })[]>({ 
    queryKey: ["/api/shared-boards"],
  });

  const currentBoard = sharedBoards?.find(board => board.name === boardName);
  const isOwner = currentBoard?.role === "owner";

  // Fetch messages based on context
  const getQueryKey = () => {
    if (boardName) return [`/api/shared-boards/${boardName}/messages`];
    if (tag) return [`/api/messages/tag/${tag}`];
    return ["/api/messages"];
  };

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: getQueryKey(),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    staleTime: 1000,
  });

  // Apply sorting
  const sortedMessages = useMemo(() => {
    if (!messages) return [];
    
    const sorted = [...messages];
    
    if (sortOrder === "newest") {
      return sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else if (sortOrder === "oldest") {
      return sorted.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } else if (sortOrder === "a-z") {
      return sorted.sort((a, b) => a.content.localeCompare(b.content));
    } else {
      return sorted.sort((a, b) => b.content.localeCompare(a.content));
    }
  }, [messages, sortOrder]);

  const getTitle = () => {
    if (boardName) return `#${boardName}`;
    if (tag) return `#${tag}`;
    return "All Texts";
  };

  const getBoardIcon = () => {
    if (boardName) return <Users className="w-4 h-4 text-[#263d57]/60" />;
    if (tag) return <User className="w-4 h-4 text-[#263d57]/60" />;
    return null;
  };

  return (
    <div>
      {/* Header with title and controls */}
      <div className="h-[100px] flex flex-col justify-center mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-[#263d57]">
              {getTitle()}
            </h1>
            {getBoardIcon()}
          </div>

          <div className="flex items-center gap-3">
            {/* Sort Control */}
            {messages && messages.length > 0 && (
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-[#263d57]/60" />
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "newest" | "oldest" | "a-z" | "z-a")}>
                  <SelectTrigger className="w-[160px] bg-white border-[#e3cac0] focus:border-[#b95827]" data-testid="select-sort-messages">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem 
                      value="newest"
                      data-pendo="board-sort-option"
                      data-sort-type="newest"
                      data-board-type={boardName ? "shared" : "private"}
                    >
                      Newest First
                    </SelectItem>
                    <SelectItem 
                      value="oldest"
                      data-pendo="board-sort-option"
                      data-sort-type="oldest"
                      data-board-type={boardName ? "shared" : "private"}
                    >
                      Oldest First
                    </SelectItem>
                    <SelectItem 
                      value="a-z"
                      data-pendo="board-sort-option"
                      data-sort-type="alphabetical"
                      data-board-type={boardName ? "shared" : "private"}
                    >
                      A to Z
                    </SelectItem>
                    <SelectItem 
                      value="z-a"
                      data-pendo="board-sort-option"
                      data-sort-type="alphabetical-reverse"
                      data-board-type={boardName ? "shared" : "private"}
                    >
                      Z to A
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Board Controls */}
            {(tag || boardName) && (
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Add Card Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setModalCurrentTag(currentTagRef.current);
                  setAddMessageModalOpen(true);
                }}
                className="h-8 px-2 lg:px-3 hover:bg-[#b95827]/10 hover:text-[#b95827]"
                aria-label="Add card"
                data-pendo="button-add-card"
                data-board-name={tag || boardName}
              >
                <Plus className="h-4 w-4 lg:mr-2" />
                <span className="hidden lg:inline">Add Card</span>
              </Button>

              {/* Private board controls */}
              {tag && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRenameBoardType("private");
                      setRenameBoardModalOpen(true);
                    }}
                    className="h-8 px-2 lg:px-3 hover:bg-blue-50 hover:text-blue-600"
                    aria-label={`Rename tag ${tag}`}
                    data-pendo="button-rename-private-board"
                    data-board-name={tag}
                  >
                    <Edit className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">Rename</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInviteToPrivateBoardModalOpen(true)}
                    className="h-8 px-2 lg:px-3 hover:bg-green-50 hover:text-green-600"
                    aria-label={`Invite users to ${tag}`}
                    data-pendo="button-invite-to-private-board"
                    data-board-name={tag}
                  >
                    <UserPlus className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">Invite</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTagModalOpen(true)}
                    className="h-8 px-2 lg:px-3 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete tag ${tag}`}
                    data-pendo="button-delete-private-board"
                    data-board-name={tag}
                  >
                    <Trash2 className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">Delete</span>
                  </Button>
                </>
              )}

              {/* Shared board controls */}
              {boardName && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMembersModalOpen(true)}
                    className="h-8 px-2 lg:px-3 hover:bg-green-50 hover:text-green-600"
                    aria-label={`View members of ${boardName}`}
                    data-pendo="button-view-members"
                    data-board-name={boardName}
                  >
                    <Eye className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">Members</span>
                  </Button>
                  {isOwner && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRenameBoardType("shared");
                          setRenameBoardModalOpen(true);
                        }}
                        className="h-8 px-2 lg:px-3 hover:bg-purple-50 hover:text-purple-600"
                        aria-label={`Rename board ${boardName}`}
                        data-pendo="button-rename-shared-board"
                        data-board-name={boardName}
                      >
                        <Edit className="h-4 w-4 lg:mr-2" />
                        <span className="hidden lg:inline">Rename</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInviteModalOpen(true)}
                        className="h-8 px-2 lg:px-3 hover:bg-blue-50 hover:text-blue-600"
                        aria-label={`Invite users to ${boardName}`}
                        data-pendo="button-invite-to-shared-board"
                        data-board-name={boardName}
                      >
                        <UserPlus className="h-4 w-4 lg:mr-2" />
                        <span className="hidden lg:inline">Invite</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteBoardModalOpen(true)}
                        className="h-8 px-2 lg:px-3 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete board ${boardName}`}
                        data-pendo="button-delete-shared-board"
                        data-board-name={boardName}
                      >
                        <Trash2 className="h-4 w-4 lg:mr-2" />
                        <span className="hidden lg:inline">Delete</span>
                      </Button>
                    </>
                  )}
                </>
              )}
              </div>
            )}
          </div>
        </div>
        
        {/* Divider */}
        <div className="w-full h-px bg-[#e3cac0] mt-4"></div>
      </div>

      <MessageList tag={tag} sharedBoard={boardName} messages={sortedMessages} isLoading={isLoading} />

      {/* Modals */}
      <AddMessageModal
        isOpen={addMessageModalOpen}
        onClose={() => setAddMessageModalOpen(false)}
        currentTag={modalCurrentTag}
      />
      
      {tag && (
        <>
          <DeleteTagModal
            isOpen={deleteTagModalOpen}
            onClose={() => setDeleteTagModalOpen(false)}
            tag={tag}
          />
          <InviteToPrivateBoardModal
            isOpen={inviteToPrivateBoardModalOpen}
            onClose={() => setInviteToPrivateBoardModalOpen(false)}
            boardName={tag}
          />
          <RenameBoardModal
            isOpen={renameBoardModalOpen}
            onClose={() => setRenameBoardModalOpen(false)}
            currentName={tag}
            boardType={renameBoardType}
          />
        </>
      )}

      {boardName && currentBoard && (
        <>
          <BoardMembersModal
            isOpen={membersModalOpen}
            onClose={() => setMembersModalOpen(false)}
            boardName={boardName}
          />
          {isOwner && (
            <>
              <InviteUserModal
                isOpen={inviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                boardName={boardName}
              />
              <RenameBoardModal
                isOpen={renameBoardModalOpen}
                onClose={() => setRenameBoardModalOpen(false)}
                currentName={boardName}
                boardId={currentBoard.id}
                boardType={renameBoardType}
              />
              <DeleteSharedBoardModal
                isOpen={deleteBoardModalOpen}
                onClose={() => setDeleteBoardModalOpen(false)}
                boardName={boardName}
                boardId={currentBoard.id}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
