import { MessageList } from "@/components/messages/MessageList";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Edit, UserPlus, X, Eye, Trash2, Plus } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { DeleteTagModal } from "@/components/layout/DeleteTagModal";
import { InviteUserModal } from "@/components/shared-boards/InviteUserModal";
import { InviteToPrivateBoardModal } from "@/components/shared-boards/InviteToPrivateBoardModal";
import { BoardMembersModal } from "@/components/shared-boards/BoardMembersModal";
import { DeleteSharedBoardModal } from "@/components/shared-boards/DeleteSharedBoardModal";
import { RenameBoardModal } from "@/components/shared-boards/RenameBoardModal";
import { AddMessageModal } from "@/components/messages/AddMessageModal";
import { SharedBoard } from "@shared/schema";

export default function AllTexts() {
  const params = useParams();
  const tag = params.tag;
  const boardName = params.boardName;
  const currentTagRef = useRef<string>("");
  
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

  const getTitle = () => {
    if (boardName) return `#${boardName}`;
    if (tag) return `#${tag}`;
    return "All Texts";
  };

  const getBoardType = () => {
    if (boardName) return "Shared Board";
    if (tag) return "Private Board";
    return null;
  };

  return (
    <div>
      {/* Header with title and controls */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-[#263d57]">
              {getTitle()}
            </h1>
            {getBoardType() && (
              <span className="text-sm text-[#263d57]/60 mt-1">
                {getBoardType()}
              </span>
            )}
          </div>

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
                className="h-8 px-2 sm:px-3 hover:bg-[#b95827]/10 hover:text-[#b95827]"
                aria-label="Add card"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Card</span>
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
                    className="h-8 px-2 sm:px-3 hover:bg-blue-50 hover:text-blue-600"
                    aria-label={`Rename tag ${tag}`}
                  >
                    <Edit className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Rename</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInviteToPrivateBoardModalOpen(true)}
                    className="h-8 px-2 sm:px-3 hover:bg-green-50 hover:text-green-600"
                    aria-label={`Invite users to ${tag}`}
                  >
                    <UserPlus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Invite</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTagModalOpen(true)}
                    className="h-8 px-2 sm:px-3 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete tag ${tag}`}
                  >
                    <Trash2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Delete</span>
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
                    className="h-8 px-2 sm:px-3 hover:bg-green-50 hover:text-green-600"
                    aria-label={`View members of ${boardName}`}
                  >
                    <Eye className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Members</span>
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
                        className="h-8 px-2 sm:px-3 hover:bg-purple-50 hover:text-purple-600"
                        aria-label={`Rename board ${boardName}`}
                      >
                        <Edit className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Rename</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInviteModalOpen(true)}
                        className="h-8 px-2 sm:px-3 hover:bg-blue-50 hover:text-blue-600"
                        aria-label={`Invite users to ${boardName}`}
                      >
                        <UserPlus className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Invite</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteBoardModalOpen(true)}
                        className="h-8 px-2 sm:px-3 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete board ${boardName}`}
                      >
                        <Trash2 className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Extended horizontal line below title */}
        <div className="border-b border-[#e3cac0]"></div>
      </div>

      <MessageList tag={tag} sharedBoard={boardName} />

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
