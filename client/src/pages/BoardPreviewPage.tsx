import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layout } from "@/components/layout/Layout";
import { Loader2 } from "lucide-react";
import { pendo } from "@/lib/pendo";

interface BoardPreview {
  id: number;
  name: string;
  totalMessages: number;
  hasContent: boolean;
}

export default function BoardPreviewPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  const boardId = params.boardId;

  // Fetch board preview
  const { data: boardPreview, isLoading: boardLoading, error: boardError } = useQuery<BoardPreview>({
    queryKey: ['/api/shared-boards', boardId, 'preview'],
    queryFn: async () => {
      const res = await fetch(`/api/shared-boards/${boardId}/preview`);
      if (!res.ok) throw new Error('Failed to load board');
      return res.json();
    },
    enabled: !!boardId,
    retry: false,
  });

  // Check if user is already authenticated
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
  });

  // Redirect authenticated users directly to the board
  useEffect(() => {
    if (user && boardPreview) {
      setLocation(`/tag/shared/${boardPreview.name}`);
    }
  }, [user, boardPreview, setLocation]);

  // Store board ID in localStorage as soon as we have it (before preview loads)
  useEffect(() => {
    if (boardId && !user) {
      localStorage.setItem('pendingBoardId', boardId);
    }
  }, [boardId, user]);

  // Show join modal for non-authenticated users
  useEffect(() => {
    if (boardId && !user) {
      setShowJoinModal(true);
      // Update board name once preview loads
      if (boardPreview) {
        localStorage.setItem('pendingBoardName', boardPreview.name);
      }
    }
  }, [boardPreview, user, boardId]);

  // Track landing page view
  useEffect(() => {
    pendo.track('Board Preview Viewed', {
      boardId: boardId || 'unknown',
      boardName: boardPreview?.name || 'unknown',
    });
  }, [boardId, boardPreview]);

  const handleJoinClick = () => {
    pendo.track('Join Button Clicked', {
      source: 'board_preview',
      boardId: boardId || 'unknown',
      boardName: boardPreview?.name || 'unknown',
    });
    setLocation('/login');
  };

  // Show loading state
  if (boardLoading) {
    return (
      <div className="min-h-screen bg-[#fff2ea] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#b95827]" />
      </div>
    );
  }

  // Show error if board not found
  if (boardError || !boardPreview) {
    return (
      <div className="min-h-screen bg-[#fff2ea] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#263d57] mb-2">Board Not Found</h1>
          <p className="text-[#263d57]/70 mb-4">This board doesn't exist or has been deleted.</p>
          <Button onClick={() => setLocation('/login')} data-testid="button-go-to-login">
            Go to Aside
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Blurred board preview with full layout */}
      <div className="relative min-h-screen">
        <div className="filter blur-md opacity-60 pointer-events-none">
          <Layout>
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold text-[#263d57] mb-6">
                #{boardPreview.name}
              </h1>
              
              {/* Show placeholder content cards */}
              {boardPreview.hasContent && Array.from({ length: Math.min(5, boardPreview.totalMessages) }).map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg border border-[#e3cac0] shadow-sm mb-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
              
              {boardPreview.totalMessages === 0 && (
                <p className="text-[#263d57]/70 text-center py-12">No messages yet</p>
              )}
            </div>
          </Layout>
        </div>

        {/* Join modal overlay */}
        <Dialog open={showJoinModal && !user} onOpenChange={() => {}}>
          <DialogContent 
            className="sm:max-w-md bg-white"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl text-[#263d57]">
                Join #{boardPreview.name}
              </DialogTitle>
              <DialogDescription className="text-[#263d57]/70">
                You've been invited to view this shared board. Sign in or create an account to see {boardPreview.totalMessages} saved {boardPreview.totalMessages === 1 ? 'message' : 'messages'}.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-4">
              <Button 
                onClick={handleJoinClick}
                className="w-full bg-[#b95827] hover:bg-[#a04d20] text-white"
                data-testid="button-join-board"
              >
                Join Board
              </Button>
              
              <p className="text-xs text-[#263d57]/60 text-center">
                By joining, you agree to our{" "}
                <a 
                  href="https://textaside.com/privacy-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-[#b95827]"
                >
                  Privacy Policy
                </a>
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
