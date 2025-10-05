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
      // Convert board name to slug format for hashtag
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      
      // For private boards, we'll create a dummy message with just the hashtag
      // to establish the category, then delete it - this creates the hashtag without content
      const hashtagName = `#${slug}`;
      
      return apiRequest("/api/messages", {
        method: "POST",
        body: JSON.stringify({ 
          content: hashtagName,
          hashtags: [slug] // Store slug without # for storage
        })
      });
    },
    onSuccess: async () => {
      // Invalidate tags to refresh the sidebar
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      const slug = boardName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      toast({
        title: "Private board created",
        description: `Your private board #${slug} has been created successfully.`
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
      <DialogContent className="sm:max-w-md bg-[#fff2ea] border-[#e3cac0]">
        <DialogHeader>
          <DialogTitle>Create Private Board</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Private boards are personal hashtag categories visible only to you. Perfect for organizing your own messages.
          </p>
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
            This will create a hashtag category that is private to you. No need to include the # symbol - it will be added automatically.
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