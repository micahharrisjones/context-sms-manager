import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Hash, X, Users, User, Plus, LogOut, Settings, Bell, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { SearchBar } from "./SearchBar";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { AdminButton } from "./AdminButton";
import { CreateSharedBoardModal } from "../shared-boards/CreateSharedBoardModal";
import { CreatePrivateBoardModal } from "../shared-boards/CreatePrivateBoardModal";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { SharedBoard } from "@shared/schema";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [createBoardModalOpen, setCreateBoardModalOpen] = useState(false);
  const [createPrivateBoardModalOpen, setCreatePrivateBoardModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  
  const { data: tags } = useQuery<string[]>({ 
    queryKey: ["/api/tags"],
    staleTime: 1000, // Consider data stale after 1 second for faster updates
    refetchInterval: 3000 // Fast fallback polling for tags
  });

  const { data: sharedBoards } = useQuery<(SharedBoard & { role: string })[]>({ 
    queryKey: ["/api/shared-boards"],
    staleTime: 1000, // Consider data stale after 1 second for faster updates
    refetchInterval: 3000 // Fast fallback polling for shared boards
  });

  return (
    <div className="w-full lg:w-64 h-full lg:h-screen bg-[#fff2ea] border-r border-[#e3cac0] flex flex-col lg:overflow-hidden">
      {/* Logo Section */}
      <div className="p-6 border-b border-[#e3cac0] flex justify-between items-center flex-shrink-0">
        <Link href="/" className="flex-1 flex justify-center lg:justify-start" data-pendo="link-home-logo">
          <Logo className="w-auto h-10 lg:h-14" />
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
            data-pendo="button-close-sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 lg:overflow-hidden">
        <div className="p-4 flex-shrink-0">
          {/* All Texts Button */}
          <div className={cn(
            "rounded-lg transition-all shadow-md",
            location === "/all-texts" 
              ? "bg-primary/5 shadow-lg" 
              : "bg-[#e3cac0]/10"
          )}>
            <Link href="/all-texts" data-pendo="link-all-texts">
              <Button 
                variant="ghost" 
                className={cn(
                  "w-full justify-start m-1",
                  location === "/all-texts" 
                    ? "bg-transparent text-primary font-medium hover:bg-transparent" 
                    : "hover:bg-[#e3cac0]/30 text-[#263d57]"
                )}
                size="lg"
                onClick={onClose}
                data-pendo="button-all-texts"
              >
                All Texts
              </Button>
            </Link>
          </div>
        </div>
      {/* Scrollable Tags and Shared Boards */}
      <ScrollArea className="flex-1 min-h-0 lg:overflow-auto">
        {/* Private Boards Section */}
        <div className="px-4 pt-2 pb-0">
          <div className="flex items-center justify-between text-sm font-medium text-[#263d57]/70 mb-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Private Boards
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-[#e3cac0]/30"
              onClick={() => setCreatePrivateBoardModalOpen(true)}
              data-pendo="button-create-private-board"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="px-4 pb-4 space-y-2">
          {tags?.map((tag) => (
            <div key={tag}>
              <Link href={`/tag/private/${tag}`} data-pendo="sidebar-board-link" data-board-type="private" data-board-name={tag}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start hover:bg-[#e3cac0]/30 text-[#263d57]",
                    location === `/tag/private/${tag}` && "bg-[#e3cac0]/30"
                  )}
                  onClick={onClose}
                  data-pendo="sidebar-board-link"
                  data-board-type="private"
                  data-board-name={tag}
                >
                  <Hash className="w-4 h-4 mr-2" />
                  {tag}
                </Button>
              </Link>
            </div>
          ))}
        </div>
        
        {/* Shared Boards Section */}
        <div className="px-4 py-2">
          <div className="border-t border-[#e3cac0] mb-4"></div>
          <div className="flex items-center justify-between text-sm font-medium text-[#263d57]/70 mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Shared Boards
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-[#e3cac0]/30"
              onClick={() => setCreateBoardModalOpen(true)}
              data-pendo="button-create-shared-board"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {sharedBoards && sharedBoards.length > 0 && (
          <div className="px-4 space-y-2">
            {sharedBoards.map((board) => (
              <div key={board.id}>
                <Link href={`/tag/shared/${board.name}`} data-pendo="sidebar-board-link" data-board-type="shared" data-board-id={board.id} data-board-name={board.name}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start hover:bg-[#e3cac0]/30 text-[#263d57]",
                      location === `/tag/shared/${board.name}` && "bg-[#e3cac0]/30"
                    )}
                    onClick={onClose}
                    data-pendo="sidebar-board-link"
                    data-board-type="shared"
                    data-board-id={board.id}
                    data-board-name={board.name}
                  >
                    <Hash className="w-4 w-4 mr-2" />
                    {board.name}
                    {board.role === "owner" && (
                      <span className="ml-auto text-xs text-[#263d57]/70">owner</span>
                    )}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
        {sharedBoards && sharedBoards.length === 0 && (
          <div className="px-4 text-xs text-[#263d57]/70">
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
          
          {/* Admin Button - Only show for admin users */}
          <AdminButton onClose={onClose} location={location} />
          
          {/* Account Management Buttons */}
        </div>
      </ScrollArea>
      
      {/* Fixed bottom section with profile, settings and logout */}
      <div className="flex-shrink-0 p-4 border-t border-[#e3cac0] space-y-1">
        <Button
          variant="ghost"
          onClick={() => setDeleteAccountModalOpen(true)}
          className="w-full justify-start text-[#263d57]/70 hover:text-red-600 hover:bg-red-50"
          data-pendo="button-delete-account"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Account
        </Button>
        
        <Link href="/notifications" data-pendo="link-notification-settings">
          <Button
            variant="ghost"
            className="w-full justify-start text-[#263d57]/70 hover:text-[#263d57] hover:bg-[#e3cac0]/20"
            onClick={onClose}
            data-pendo="button-notification-settings"
          >
            <Bell className="h-4 w-4 mr-2" />
            Notification Settings
          </Button>
        </Link>
        
        <Button
          variant="ghost"
          onClick={logout}
          className="w-full justify-start text-[#263d57]/70 hover:text-red-600 hover:bg-[#e3cac0]/20"
          data-pendo="button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
      </div>
      
      <CreateSharedBoardModal
        isOpen={createBoardModalOpen}
        onClose={() => setCreateBoardModalOpen(false)}
      />
      
      <CreatePrivateBoardModal
        isOpen={createPrivateBoardModalOpen}
        onClose={() => setCreatePrivateBoardModalOpen(false)}
      />
      
      <DeleteAccountModal
        isOpen={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
      />
    </div>
  );
}