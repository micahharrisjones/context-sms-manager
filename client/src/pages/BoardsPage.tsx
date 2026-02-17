import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Users, Lock, Globe, Hash } from "lucide-react";
import { SharedBoard } from "@shared/schema";
import { CreateSharedBoardModal } from "@/components/shared-boards/CreateSharedBoardModal";
import { CreatePrivateBoardModal } from "@/components/shared-boards/CreatePrivateBoardModal";

export default function BoardsPage() {
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showCreateSharedModal, setShowCreateSharedModal] = useState(false);
  const [showCreatePrivateModal, setShowCreatePrivateModal] = useState(false);

  const { data: privateTags, isLoading: tagsLoading } = useQuery<string[]>({
    queryKey: ["/api/tags"],
  });

  const { data: sharedBoards, isLoading: sharedLoading } = useQuery<
    (SharedBoard & { role: string })[]
  >({
    queryKey: ["/api/shared-boards"],
  });

  return (
    <div>
      <div className="mb-6">
        <div className="h-[60px] flex items-center gap-2">
          <img src="/aside-logo-loader.png" alt="Aside" className="w-7 h-7 object-contain" />
          <h1 className="text-2xl font-semibold text-[#263d57]" data-pendo="boards-page-title">
            Your Boards
          </h1>
        </div>
        <div className="w-full h-px bg-[#e3cac0]"></div>
      </div>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-[#b95827]" />
          <h2 className="text-lg font-semibold text-[#263d57]">Private Boards</h2>
        </div>

        {tagsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-white/60 animate-pulse"
              />
            ))}
          </div>
        ) : privateTags && privateTags.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {privateTags.map((tag) => (
              <Link
                key={tag}
                href={`/tag/private/${tag}`}
                data-pendo="board-card-private"
              >
                <div className="bg-white rounded-xl shadow-sm border border-[#e3cac0]/40 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Hash className="w-4 h-4 text-[#b95827]" />
                      <span className="font-semibold text-[#263d57] text-sm truncate">
                        {tag}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Lock className="w-3 h-3 text-[#b95827]/50" />
                    <span className="text-xs text-[#263d57]/50">Private</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white/60 rounded-xl border border-[#e3cac0]/40 p-6 text-center">
            <Hash className="w-8 h-8 text-[#b95827]/30 mx-auto mb-2" />
            <p className="text-sm text-[#263d57]/60">
              No private boards yet. Text a message with a #hashtag to create one.
            </p>
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-[#263d57]" />
          <h2 className="text-lg font-semibold text-[#263d57]">Shared Boards</h2>
        </div>

        {sharedLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-white/60 animate-pulse"
              />
            ))}
          </div>
        ) : sharedBoards && sharedBoards.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sharedBoards.map((board) => (
              <Link
                key={board.id}
                href={`/tag/shared/${board.name}`}
                data-pendo="board-card-shared"
              >
                <div className="bg-white rounded-xl shadow-sm border border-[#e3cac0]/40 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Hash className="w-4 h-4 text-[#263d57]" />
                      <span className="font-semibold text-[#263d57] text-sm truncate">
                        {board.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-[#263d57]/50" />
                      <span className="text-xs text-[#263d57]/50">Shared</span>
                    </div>
                    {board.role === "owner" && (
                      <span className="text-[10px] font-medium bg-[#b95827]/10 text-[#b95827] px-1.5 py-0.5 rounded-full">
                        Owner
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white/60 rounded-xl border border-[#e3cac0]/40 p-6 text-center">
            <Users className="w-8 h-8 text-[#263d57]/30 mx-auto mb-2" />
            <p className="text-sm text-[#263d57]/60">
              No shared boards yet. Create one to collaborate with friends.
            </p>
          </div>
        )}
      </section>

      <div className="fixed bottom-24 right-4 z-50">
        {showCreateMenu && (
          <div className="mb-3 bg-white rounded-xl shadow-lg border border-[#e3cac0] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={() => {
                setShowCreateMenu(false);
                setShowCreatePrivateModal(true);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-[#faf6f3] transition-colors"
              data-pendo="boards-create-private-btn"
            >
              <Lock className="w-4 h-4 text-[#b95827]" />
              <span className="text-sm font-medium text-[#263d57]">Private Board</span>
            </button>
            <div className="border-t border-[#e3cac0]/40" />
            <button
              onClick={() => {
                setShowCreateMenu(false);
                setShowCreateSharedModal(true);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-[#faf6f3] transition-colors"
              data-pendo="boards-create-shared-btn"
            >
              <Globe className="w-4 h-4 text-[#263d57]" />
              <span className="text-sm font-medium text-[#263d57]">Shared Board</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setShowCreateMenu(!showCreateMenu)}
          className="w-14 h-14 rounded-full bg-[#b95827] text-white shadow-lg hover:bg-[#a04d22] transition-all flex items-center justify-center"
          data-pendo="boards-fab-create"
        >
          <Plus className={`w-6 h-6 transition-transform duration-200 ${showCreateMenu ? "rotate-45" : ""}`} />
        </button>
      </div>

      {showCreateMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowCreateMenu(false)}
        />
      )}

      <CreatePrivateBoardModal
        isOpen={showCreatePrivateModal}
        onClose={() => setShowCreatePrivateModal(false)}
      />
      <CreateSharedBoardModal
        isOpen={showCreateSharedModal}
        onClose={() => setShowCreateSharedModal(false)}
      />
    </div>
  );
}