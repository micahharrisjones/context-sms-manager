import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: number;
  messagePreview: string;
}

export function DeleteMessageModal({ 
  isOpen, 
  onClose, 
  messageId, 
  messagePreview 
}: DeleteMessageModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMessageMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete message');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message deleted",
        description: "The message has been permanently removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteMessageMutation.mutate();
  };

  const handleClose = () => {
    if (!deleteMessageMutation.isPending) {
      onClose();
    }
  };

  // Truncate message preview for display
  const truncatedPreview = messagePreview.length > 100 
    ? messagePreview.substring(0, 100) + "..." 
    : messagePreview;

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Message</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span>Are you sure you want to delete this message? This action cannot be undone.</span>
            <div className="p-3 bg-[#fff1e2] rounded-md border-l-4 border-gray-300">
              <p className="text-sm text-gray-700 italic">"{truncatedPreview}"</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMessageMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMessageMutation.isPending}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {deleteMessageMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}