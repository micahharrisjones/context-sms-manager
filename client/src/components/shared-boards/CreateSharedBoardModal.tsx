import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CreateSharedBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSharedBoardModal({ isOpen, onClose }: CreateSharedBoardModalProps) {
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

      const response = await apiRequest("/api/shared-boards", {
        method: "POST",
        body: JSON.stringify({ name: slug }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        description: `Created shared board #${data.name}`,
      });
      // Invalidate shared boards query to refresh the sidebar
      queryClient.invalidateQueries({ queryKey: ["/api/shared-boards"] });
      onClose();
      setBoardName("");
    },
    onError: (error: any) => {
      toast({
        description: error.message || "Failed to create shared board",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim()) {
      toast({
        description: "Board name is required",
        variant: "destructive",
      });
      return;
    }
    createBoardMutation.mutate(boardName.trim());
  };

  const handleClose = () => {
    setBoardName("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#fff2ea] border-[#e3cac0]" data-pendo="modal-create-shared-board">
        <DialogHeader>
          <DialogTitle>Create Shared Board</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Shared boards allow multiple users to collaborate and receive real-time notifications when hashtag content is added.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="boardName">Board Name</Label>
            <Input
              id="boardName"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="Enter board name (e.g., project, team, family)"
              className="w-full"
              disabled={createBoardMutation.isPending}
              data-pendo="input-shared-board-name"
            />
            <p className="text-sm text-muted-foreground">
              This will create a hashtag category that can be shared with others.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={createBoardMutation.isPending}
              data-pendo="modal-cancel-btn"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={createBoardMutation.isPending || !boardName.trim()}
              data-pendo="modal-save-btn"
            >
              {createBoardMutation.isPending ? "Creating..." : "Create Board"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}