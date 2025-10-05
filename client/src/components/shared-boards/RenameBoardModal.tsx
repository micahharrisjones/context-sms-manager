import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface RenameBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardType: "shared" | "private";
  currentName: string;
  boardId?: number; // For shared boards
}

export function RenameBoardModal({ 
  isOpen, 
  onClose, 
  boardType, 
  currentName, 
  boardId 
}: RenameBoardModalProps) {
  const [newName, setNewName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (name: string) => {
      if (boardType === "shared") {
        if (!boardId) throw new Error("Board ID is required for shared boards");
        const response = await apiRequest(`/api/shared-boards/${boardId}/rename`, {
          method: "PUT",
          body: JSON.stringify({ newName: name }),
        });
        return await response.json();
      } else {
        const response = await apiRequest(`/api/private-boards/${encodeURIComponent(currentName)}/rename`, {
          method: "PUT",
          body: JSON.stringify({ newName: name }),
        });
        return await response.json();
      }
    },
    onSuccess: (data) => {
      toast({
        description: data.message,
      });
      // Invalidate relevant queries to refresh the sidebar
      if (boardType === "shared") {
        queryClient.invalidateQueries({ queryKey: ["/api/shared-boards"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      }
      // Also invalidate messages queries to update any displayed content
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      onClose();
      setNewName("");
    },
    onError: (error: any) => {
      toast({
        description: error.message || "Failed to rename board",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast({
        description: "Board name is required",
        variant: "destructive",
      });
      return;
    }
    renameMutation.mutate(newName.trim());
  };

  const handleClose = () => {
    setNewName("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#fff2ea] border-[#e3cac0]">
        <DialogHeader>
          <DialogTitle>
            Rename {boardType === "shared" ? "Shared" : "Private"} Board
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {boardType === "shared" 
              ? "Change the name of this shared board. All members will see the new name."
              : "Change the name of this private board. This will update all your messages with this hashtag."
            }
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentName">Current Name</Label>
            <Input
              id="currentName"
              value={`#${currentName}`}
              disabled
              className="bg-gray-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newName">New Name</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new board name"
              maxLength={50}
              className="border-[#e3cac0] focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">
              Will be formatted as: #{newName.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-[#e3cac0] hover:bg-[#e3cac0]/20"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={renameMutation.isPending || !newName.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {renameMutation.isPending ? "Renaming..." : "Rename Board"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}