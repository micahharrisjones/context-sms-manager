import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

interface DeleteSharedBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardName: string;
  boardId: number;
}

export function DeleteSharedBoardModal({ 
  isOpen, 
  onClose, 
  boardName, 
  boardId 
}: DeleteSharedBoardModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteSharedBoardMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/shared-boards/${boardId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Board Deleted",
        description: `Shared board #${boardName} has been permanently deleted along with all its members and access.`,
      });
      
      // Invalidate all queries that could show this board or its messages
      queryClient.invalidateQueries({ queryKey: ["/api/shared-boards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] }); // All messages
      queryClient.invalidateQueries({ queryKey: ["/api/messages/by-tag"] }); // Tag-based queries
      
      onClose();
    },
    onError: (error: any) => {
      console.error("Failed to delete shared board:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "There was an error deleting the shared board. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteSharedBoardMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#fff2ea] border-[#e3cac0]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-[#263d57]">
                Delete Shared Board
              </DialogTitle>
              <DialogDescription className="text-sm text-[#263d57]/70 mt-1">
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-red-50 border border-[#e3cac0] rounded-lg p-4">
            <p className="text-sm text-[#263d57] mb-3">
              Are you sure you want to delete the shared board <strong>#{boardName}</strong>?
            </p>
            <div className="text-sm text-[#263d57]/70">
              <p className="mb-2"><strong>This will:</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Permanently remove the shared board</li>
                <li>Remove all members from the board</li>
                <li>Stop real-time notifications for this board</li>
                <li><strong>Note:</strong> Messages with #{boardName} hashtags will remain in user accounts but won't be shared anymore</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={deleteSharedBoardMutation.isPending}
            data-pendo="button-cancel-delete-shared-board"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteSharedBoardMutation.isPending}
            data-pendo="button-confirm-delete-shared-board"
            data-board-name={boardName}
          >
            {deleteSharedBoardMutation.isPending ? "Deleting..." : "Delete Board"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}