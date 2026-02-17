import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";
import { pendo } from "@/lib/pendo";
import { MessageCard } from "@/components/messages/MessageCard";

interface BoardPreview {
  id: number;
  name: string;
  totalMessages: number;
  hasContent: boolean;
}

export default function JoinPage() {
  const [, setLocation] = useLocation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const { toast } = useToast();

  // Extract board ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const boardId = urlParams.get('board');

  // Fetch board preview if board ID is present
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
    retry: false,
  });

  // If user is authenticated and viewing a board invite, redirect to the board
  useEffect(() => {
    if (user && boardId && boardPreview) {
      setLocation(`/tag/shared/${boardPreview.name}`);
    }
  }, [user, boardId, boardPreview, setLocation]);

  // Store board ID in localStorage as soon as we have it (before preview loads)
  // This ensures we don't lose the board context if preview fails
  useEffect(() => {
    if (boardId && !user) {
      localStorage.setItem('pendingBoardId', boardId);
    }
  }, [boardId, user]);

  // Show join modal when viewing a board invite and user is not authenticated
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
    pendo.track('Invite Landing Viewed', {
      source: boardId ? 'board_invite' : 'invite_link',
      boardId: boardId || undefined,
    });
  }, [boardId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiRequest("/api/invite/submit", {
        method: "POST",
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim()
        })
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        
        // Track phone number submission
        pendo.track('Invite Phone Submitted', {
          phoneNumber: phoneNumber.trim(),
          boardId: boardId || undefined,
        });
        
        toast({
          title: "Success!",
          description: data.message || "Check your phone for a confirmation text",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send SMS. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  // If viewing a board preview, show blurred background with modal
  if (boardId) {
    return (
      <div className="min-h-screen bg-[#faf6f3] relative">
        {/* Blurred board preview in background */}
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#faf6f3] to-[#e3cac0]">
          <div className="filter blur-sm opacity-60 pointer-events-none p-4 pt-20">
            {boardLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-[#b95827]" />
              </div>
            ) : boardPreview ? (
              <div className="max-w-4xl mx-auto space-y-4">
                <h1 className="text-3xl font-bold text-[#263d57] mb-6">
                  #{boardPreview.name}
                </h1>
                {/* Show placeholder content cards instead of actual messages for security */}
                {boardPreview.hasContent && Array.from({ length: Math.min(5, boardPreview.totalMessages) }).map((_, i) => (
                  <div key={i} className="bg-white p-4 rounded-lg border border-[#e3cac0] shadow-sm">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
                {boardPreview.totalMessages === 0 && (
                  <p className="text-[#263d57]/70 text-center">No messages yet</p>
                )}
              </div>
            ) : boardError ? (
              <div className="flex justify-center items-center h-64">
                <p className="text-[#263d57]/70">Board preview unavailable</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Join modal overlay */}
        <Dialog open={showJoinModal} onOpenChange={() => {}}>
          <DialogContent 
            className="sm:max-w-md bg-white border-[#e3cac0]"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            {submitted ? (
              <div className="space-y-6 text-center py-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <DialogTitle className="text-2xl font-bold text-[#263d57]">
                    Check your phone!
                  </DialogTitle>
                  <DialogDescription className="text-[#263d57]/70">
                    We sent you a text. Reply <strong>YES</strong> to confirm and start using Aside.
                    {boardPreview && (
                      <span className="block mt-2">
                        You'll be added to <strong>#{boardPreview.name}</strong> after setup.
                      </span>
                    )}
                  </DialogDescription>
                </div>
              </div>
            ) : (
              <>
                <DialogHeader>
                  <div className="text-center mb-4">
                    <img 
                      src="/aside-logo-login.png" 
                      alt="Aside Logo" 
                      className="w-32 h-auto mx-auto"
                    />
                  </div>
                  <DialogTitle className="text-2xl font-bold text-[#263d57] text-center">
                    {boardPreview ? `Join #${boardPreview.name}` : 'Welcome to Aside'}
                  </DialogTitle>
                  <DialogDescription className="text-center">
                    {boardPreview 
                      ? `Sign up to view and contribute to this board`
                      : 'Save links and ideas by texting. Super simple - no app needed.'
                    }
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-[#263d57]">
                      How it works
                    </h3>
                    <ul className="space-y-2 text-sm text-[#263d57]/70">
                      <li className="flex items-start gap-2">
                        <span className="text-[#b95827] mt-0.5">•</span>
                        <span>Text anything to save it automatically</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#b95827] mt-0.5">•</span>
                        <span>Use #hashtags to organize messages</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#b95827] mt-0.5">•</span>
                        <span>Access your dashboard at textaside.app</span>
                      </li>
                    </ul>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-[#263d57] mb-2">
                        Enter your phone number
                      </label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={isSubmitting}
                        data-testid="input-phone-number"
                        data-pendo="input-phone-signup"
                      />
                      <p className="text-xs text-[#263d57]/50 mt-2">
                        We'll send you a text to confirm
                      </p>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-[#b95827] hover:bg-[#a04820] text-white"
                      disabled={isSubmitting}
                      data-testid="button-submit-phone"
                      data-pendo="button-get-started-signup"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Get Started"
                      )}
                    </Button>
                  </form>

                  <p className="text-xs text-[#263d57]/50 text-center">
                    By signing up via this form, I agree to get text messages from Aside for the purpose of saving ideas to a dashboard. Message frequency varies. Message & data rates may apply. Read our{' '}
                    <a 
                      href="https://www.textaside.com/privacy-policy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#b95827] hover:underline"
                    >
                      Privacy Policy
                    </a>{' '}
                    for more.
                  </p>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Regular join page (no board preview)
  if (submitted) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#faf6f3] flex items-center justify-center px-4" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-[#263d57]">
              Check your phone!
            </h1>
            <p className="text-[#263d57]/70">
              We sent you a text. Reply <strong>YES</strong> to confirm and start using Aside.
            </p>
          </div>

          <div className="mt-8 p-4 bg-white rounded-lg border border-[#e3cac0]">
            <p className="text-sm text-[#263d57]/60">
              Didn't receive the text? Check your phone number and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#faf6f3] flex items-center justify-center px-4" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img 
            src="/aside-logo-login.png" 
            alt="Aside Logo" 
            className="w-48 h-auto mx-auto"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-[#e3cac0] p-8 space-y-6">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold text-[#263d57]">
              Welcome to Aside
            </h1>
            <p className="text-[#263d57]/70 text-lg">
              Save links and ideas by texting. Super simple - no app needed.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-[#263d57]">
              How it works
            </h2>
            <ul className="space-y-2 text-[#263d57]/70">
              <li className="flex items-start gap-2">
                <span className="text-[#b95827] mt-0.5">•</span>
                <span>Text anything to save it automatically</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#b95827] mt-0.5">•</span>
                <span>Use #hashtags to organize messages</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#b95827] mt-0.5">•</span>
                <span>Access your dashboard at textaside.app</span>
              </li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-[#263d57] mb-2">
                Enter your phone number
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isSubmitting}
                className="text-lg"
                data-testid="input-phone-number"
                data-pendo="input-phone-signup"
              />
              <p className="text-xs text-[#263d57]/50 mt-2">
                We'll send you a text to confirm
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#b95827] hover:bg-[#a04820] text-white text-lg py-6"
              disabled={isSubmitting}
              data-testid="button-submit-phone"
              data-pendo="button-get-started-signup"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                "Get Started"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-[#263d57]/50">
          By signing up via this form, I agree to get text messages from Aside for the purpose of saving ideas to a dashboard. Message frequency varies. Message & data rates may apply. Read our{' '}
          <a 
            href="https://www.textaside.com/privacy-policy" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#b95827] hover:underline"
          >
            Privacy Policy
          </a>{' '}
          for more.
        </p>
      </div>
    </div>
  );
}
