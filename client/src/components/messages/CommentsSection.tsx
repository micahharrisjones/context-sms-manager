import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useQuery as useAuthQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Send, MessageCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { BoardComment } from "@shared/schema";

interface CommentsSectionProps {
  messageId: number;
  boardName: string;
  isOpen: boolean;
}

function getInitials(firstName?: string | null, lastName?: string | null, displayName?: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (displayName) return displayName[0].toUpperCase();
  return "?";
}

function getAuthorName(comment: BoardComment) {
  if (comment.authorFirstName && comment.authorLastName) {
    return `${comment.authorFirstName} ${comment.authorLastName}`;
  }
  if (comment.authorFirstName) return comment.authorFirstName;
  if (comment.authorDisplayName) return comment.authorDisplayName;
  return "Member";
}

export function CommentsSection({ messageId, boardName, isOpen }: CommentsSectionProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: session } = useAuthQuery<{ authenticated: boolean; userId?: number }>({
    queryKey: ["/api/auth/session"],
  });

  const queryKey = [`/api/shared-boards/${boardName}/messages/${messageId}/comments`];

  const { data: comments = [], isLoading } = useQuery<BoardComment[]>({
    queryKey,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen && comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, comments.length]);

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest(
        `/api/shared-boards/${boardName}/messages/${messageId}/comments`,
        { method: "POST", body: JSON.stringify({ content }) }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDraft("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest(
        `/api/shared-boards/${boardName}/messages/${messageId}/comments/${commentId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed || addMutation.isPending) return;
    addMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="mt-3 border-t border-[#e3cac0]/60 pt-3">
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-[#b95827]/50" />
        </div>
      ) : comments.length === 0 ? (
        <div className="flex items-center gap-1.5 py-1 mb-2">
          <MessageCircle className="w-3.5 h-3.5 text-[#263d57]/30" />
          <span className="text-xs text-[#263d57]/40">No comments yet. Be the first!</span>
        </div>
      ) : (
        <div className="space-y-3 mb-3 max-h-64 overflow-y-auto pr-1">
          {comments.map((comment) => {
            const isOwn = comment.userId === session?.userId;
            return (
              <div key={comment.id} className="flex gap-2.5 items-start group">
                <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                  <AvatarImage src={comment.authorAvatarUrl || undefined} />
                  <AvatarFallback className="bg-[#263d57] text-white text-[10px]">
                    {getInitials(comment.authorFirstName, comment.authorLastName, comment.authorDisplayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-[#263d57]">
                      {getAuthorName(comment)}
                    </span>
                    <span className="text-[11px] text-[#263d57]/35">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-[#263d57]/80 leading-relaxed break-words mt-0.5">
                    {comment.content}
                  </p>
                </div>
                {isOwn && (
                  <button
                    onClick={() => deleteMutation.mutate(comment.id)}
                    disabled={deleteMutation.isPending}
                    className="flex-shrink-0 p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 opacity-60 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment… (Enter to send)"
          rows={1}
          className="min-h-0 h-10 py-2 px-3 text-sm resize-none border-[#e3cac0] focus:border-[#b95827] focus-visible:ring-[#b95827]/20 rounded-lg flex-1"
          maxLength={1000}
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!draft.trim() || addMutation.isPending}
          className="h-10 w-10 p-0 bg-[#b95827] hover:bg-[#a04d22] flex-shrink-0"
          aria-label="Post comment"
        >
          {addMutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </Button>
      </div>
    </div>
  );
}
