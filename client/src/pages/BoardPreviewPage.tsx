import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layout } from "@/components/layout/Layout";
import { Loader2 } from "lucide-react";
import { pendo } from "@/lib/pendo";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface BoardPreview {
  id: number;
  name: string;
  totalMessages: number;
  hasContent: boolean;
}

export default function BoardPreviewPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  
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

  // Auto-join authenticated users to the board
  const autoJoinMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/shared-boards/${boardId}/auto-join`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to join board');
      return res.json();
    },
    onSuccess: (data) => {
      // Redirect to the board using the slug from the response
      setLocation(`/tag/shared/${data.boardName}`);
    },
  });

  // Send verification code mutation
  const sendCodeMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await fetch('/api/board-invite/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, boardId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send code');
      }
      return res.json();
    },
    onSuccess: () => {
      setStep('code');
      toast({
        title: "Code Sent!",
        description: `We sent a verification code to ${phoneNumber}`,
      });
      pendo.track('Board Invite Code Sent', {
        boardId: boardId || 'unknown',
        boardName: boardPreview?.name || 'unknown',
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Verify code and join board mutation
  const verifyCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch('/api/board-invite/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code, boardId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Invalid code');
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate user query to refresh auth state
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      toast({
        title: "Welcome!",
        description: `You're now part of #${boardPreview?.name}`,
      });
      
      pendo.track('Board Invite Verified', {
        boardId: boardId || 'unknown',
        boardName: boardPreview?.name || 'unknown',
      });
      
      // Redirect to the board
      setLocation(`/tag/shared/${data.boardName}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Redirect authenticated users directly to the board after auto-joining
  useEffect(() => {
    if (user && boardId && !autoJoinMutation.isPending && !autoJoinMutation.isSuccess) {
      autoJoinMutation.mutate();
    }
  }, [user, boardId]);

  // Show join modal for non-authenticated users
  useEffect(() => {
    if (boardId && !user) {
      setShowJoinModal(true);
    }
  }, [user, boardId]);

  // Track landing page view
  useEffect(() => {
    pendo.track('Board Preview Viewed', {
      boardId: boardId || 'unknown',
      boardName: boardPreview?.name || 'unknown',
    });
  }, [boardId, boardPreview]);

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone Required",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }
    sendCodeMutation.mutate(phoneNumber);
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      toast({
        title: "Code Required",
        description: "Please enter the verification code",
        variant: "destructive",
      });
      return;
    }
    verifyCodeMutation.mutate(verificationCode);
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
                {step === 'phone' 
                  ? `You've been invited to view this shared board with ${boardPreview.totalMessages} saved ${boardPreview.totalMessages === 1 ? 'message' : 'messages'}. Enter your number to join.`
                  : `Enter the code we sent to ${phoneNumber}`
                }
              </DialogDescription>
            </DialogHeader>
            
            {step === 'phone' ? (
              <form onSubmit={handleSendCode} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={sendCodeMutation.isPending}
                    data-testid="input-phone"
                  />
                </div>
                
                <Button 
                  type="submit"
                  className="w-full bg-[#b95827] hover:bg-[#a04d20] text-white"
                  disabled={sendCodeMutation.isPending}
                  data-testid="button-send-code"
                >
                  {sendCodeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    'Send Code'
                  )}
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
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    disabled={verifyCodeMutation.isPending}
                    autoFocus
                    data-testid="input-code"
                  />
                </div>
                
                <Button 
                  type="submit"
                  className="w-full bg-[#b95827] hover:bg-[#a04d20] text-white"
                  disabled={verifyCodeMutation.isPending}
                  data-testid="button-verify-code"
                >
                  {verifyCodeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Join Board'
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep('phone')}
                  disabled={verifyCodeMutation.isPending}
                  data-testid="button-back"
                >
                  Change Phone Number
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
