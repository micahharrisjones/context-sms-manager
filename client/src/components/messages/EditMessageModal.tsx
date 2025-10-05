import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Message } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface EditMessageModalProps {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helper function to normalize hashtag to slug format
function createBoardSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Helper function to extract hashtags from content
function extractHashtags(content: string): string[] {
  const tags = (content.match(/#[\w-]+/g) || [])
    .map((tag: string) => createBoardSlug(tag.slice(1))); // Normalize to lowercase slug format
  return Array.from(new Set(tags)); // Remove duplicates
}

export function EditMessageModal({ message, isOpen, onClose }: EditMessageModalProps) {
  const [content, setContent] = useState(message?.content || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update content when message changes
  React.useEffect(() => {
    if (message) {
      setContent(message.content);
    }
  }, [message]);

  const updateMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: number; content: string }) => {
      const tags = extractHashtags(content);
      if (tags.length === 0) {
        tags.push("uncategorized");
      }
      
      return apiRequest(`/api/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ content, tags }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Message Updated",
        description: "Your message has been successfully updated and moved to the appropriate boards.",
      });
      
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/shared-boards"], 
        predicate: (query) => query.queryKey[0] === "/api/shared-boards"
      });
      
      onClose();
    },
    onError: (error) => {
      console.error("Failed to update message:", error);
      toast({
        title: "Update Failed",
        description: "There was an error updating your message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!message) return;
    
    if (content.trim() === "") {
      toast({
        title: "Content Required",
        description: "Message content cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    updateMessageMutation.mutate({
      messageId: message.id,
      content: content.trim(),
    });
  };

  if (!message) return null;

  const currentHashtags = extractHashtags(content);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-[#fff2ea] border-[#e3cac0]">
        <DialogHeader>
          <DialogTitle>Edit Message</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="content">Message Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Edit your message content..."
              className="min-h-[120px] mt-2 bg-white border-[#e3cac0] focus:border-[#b95827]"
            />
          </div>
          
          <div className="bg-white p-3 rounded-md border border-[#e3cac0]">
            <Label className="text-sm font-medium text-gray-700">
              Current Boards:
            </Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {currentHashtags.length > 0 ? (
                currentHashtags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block bg-primary/10 text-primary px-2 py-1 rounded-md text-sm"
                  >
                    #{tag}
                  </span>
                ))
              ) : (
                <span className="inline-block bg-[#e3cac0] text-gray-600 px-2 py-1 rounded-md text-sm">
                  #uncategorized
                </span>
              )}
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p className="mb-2"><strong>Tip:</strong> Add hashtags to organize your message into boards:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Use #movies to add to the movies board</li>
              <li>Use #recipes #cooking to add to multiple boards</li>
              <li>Messages without hashtags go to #uncategorized</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={updateMessageMutation.isPending}
            className="border-[#e3cac0] hover:bg-[#e3cac0]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMessageMutation.isPending}
            className="bg-[#b95827] hover:bg-[#a04d1f]"
          >
            {updateMessageMutation.isPending ? "Updating..." : "Update Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}