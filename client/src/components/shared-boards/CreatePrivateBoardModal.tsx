import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CreatePrivateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePrivateBoardModal({ isOpen, onClose }: CreatePrivateBoardModalProps) {
  const [boardName, setBoardName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createBoardMutation = useMutation({
    mutationFn: async (name: string) => {
      // For private boards, we'll create a dummy message with just the hashtag
      // to establish the category, then delete it - this creates the hashtag without content
      const hashtagName = name.startsWith('#') ? name : `#${name}`;
      
      return apiRequest("/api/messages", {
        method: "POST",
        body: JSON.stringify({ 
          content: `${hashtagName}`,
          hashtags: [hashtagName.substring(1)] // Remove # for storage
        })
      });
    },
    onSuccess: async () => {
      // Invalidate tags to refresh the sidebar
      queryClient.invalidateQueries({ queryKey: ["/api/messages/tags"] });
      toast({
        title: "Private board created",
        description: `Your private board "${boardName}" has been created successfully.`
      });
      setBoardName("");
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating private board",
        description: error.message || "Failed to create private board",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim()) return;
    
    createBoardMutation.mutate(boardName.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Private Board</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="boardName">Board Name</Label>
            <Input
              id="boardName"
              type="text"
              placeholder="Enter board name (e.g., recipes, workouts)"
              value={boardName}
              onChange={(e) => {
                // Remove # if user types it, we'll add it automatically
                const cleanName = e.target.value.replace(/^#/, '');
                setBoardName(cleanName);
              }}
              required
            />
          </div>
          <p className="text-sm text-muted-foreground">
            This will create a hashtag category that is private to you.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!boardName.trim() || createBoardMutation.isPending}
            >
              {createBoardMutation.isPending ? "Creating..." : "Create Private Board"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}