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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Message } from '@shared/schema';

interface DeleteTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tag: string;
}

export function DeleteTagModal({ 
  isOpen, 
  onClose, 
  tag
}: DeleteTagModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get messages for this tag to show count
  const { data: messages } = useQuery<Message[]>({
    queryKey: ['/api/messages/tag', tag],
    enabled: isOpen && !!tag
  });

  const messageCount = messages?.length || 0;

  const deleteTagMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete tag');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Tag deleted",
        description: `All messages with #${tag} have been removed.`,
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
    deleteTagMutation.mutate();
  };

  const handleClose = () => {
    if (!deleteTagMutation.isPending) {
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Tag #{tag}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span>
              Are you sure you want to delete this tag? This will permanently remove all messages tagged with #{tag}.
            </span>
            {messageCount > 0 && (
              <div className="p-3 bg-red-50 rounded-md border-l-4 border-red-300">
                <p className="text-sm text-red-700 font-medium">
                  ⚠️ This will delete {messageCount} message{messageCount !== 1 ? 's' : ''}
                </p>
              </div>
            )}
            <span className="text-sm text-muted-foreground">
              This action cannot be undone.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTagMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteTagMutation.isPending}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {deleteTagMutation.isPending ? "Deleting..." : "Delete Tag"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}