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
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Message } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

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

// Helper function to extract hashtags from content (captures all #word patterns)
function extractHashtags(content: string): string[] {
  // Match # followed by word characters, even if followed by punctuation
  const tags = (content.match(/#[\w-]+/g) || [])
    .map((tag: string) => createBoardSlug(tag.slice(1)));
  return Array.from(new Set(tags)); // Remove duplicates
}

// Helper function to strip ALL hashtags from content while preserving ALL formatting
function stripHashtags(content: string): string {
  // Remove only the hashtag tokens themselves, leave ALL whitespace untouched
  return content.replace(/#[\w-]+/g, '');
}

export function EditMessageModal({ message, isOpen, onClose }: EditMessageModalProps) {
  // Initialize content without hashtags
  const [content, setContent] = useState("");
  // Initialize tags from database
  const [tags, setTags] = useState<string[]>([]);
  // State for new hashtag input
  const [newHashtag, setNewHashtag] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update content and tags when message changes
  React.useEffect(() => {
    if (message) {
      // Extract hashtags from content (for legacy messages)
      const contentHashtags = extractHashtags(message.content);
      // Use tags from database, or fall back to content hashtags
      const dbTags = message.tags && message.tags.length > 0 ? message.tags : contentHashtags;
      
      // Merge content hashtags with db tags (in case user typed new ones)
      const allTags = Array.from(new Set([...dbTags, ...contentHashtags]));
      
      setTags(allTags);
      // Strip hashtags from content for display
      setContent(stripHashtags(message.content));
    }
  }, [message]);

  const updateMessageMutation = useMutation({
    mutationFn: async ({ messageId, content, tags }: { messageId: number; content: string; tags: string[] }) => {
      const finalTags = tags.length === 0 ? ["uncategorized"] : tags;
      
      return apiRequest(`/api/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ content, tags: finalTags }),
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

    // Extract any hashtags that were typed in the content
    const contentHashtags = extractHashtags(content);
    // Merge with managed tags (remove duplicates)
    const allTags = Array.from(new Set([...tags, ...contentHashtags]));
    // Strip hashtags from content before saving (preserve ALL formatting)
    const cleanContent = stripHashtags(content);

    updateMessageMutation.mutate({
      messageId: message.id,
      content: cleanContent,
      tags: allTags,
    });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleAddTag = () => {
    const trimmedTag = newHashtag.trim().replace(/^#+/, ''); // Remove leading # if present
    if (trimmedTag === "") return;
    
    const normalizedTag = createBoardSlug(trimmedTag);
    
    // Validate that normalized tag is not empty
    if (normalizedTag === "") {
      toast({
        title: "Invalid Hashtag",
        description: "Hashtag must contain at least one letter or number.",
        variant: "destructive",
      });
      setNewHashtag("");
      return;
    }
    
    // Check if tag already exists
    if (tags.includes(normalizedTag)) {
      toast({
        title: "Duplicate Tag",
        description: "This hashtag is already added.",
        variant: "destructive",
      });
      setNewHashtag("");
      return;
    }
    
    setTags([...tags, normalizedTag]);
    setNewHashtag("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (!message) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-[#fff2ea] border-[#e3cac0]" data-pendo="modal-edit-message">
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
              data-testid="input-message-content"
              data-pendo="textarea-edit-message-content"
            />
          </div>
          
          <div className="bg-white p-3 rounded-md border border-[#e3cac0]">
            <Label className="text-sm font-medium text-[#263d57]/80">
              Current Boards:
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.length > 0 ? (
                tags.map((tag) => (
                  <div
                    key={tag}
                    className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm group hover:bg-primary/20 transition-colors"
                    data-testid={`tag-chip-${tag}`}
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:bg-primary/30 rounded-full p-0.5 transition-colors"
                      aria-label={`Remove ${tag} tag`}
                      data-testid={`button-remove-tag-${tag}`}
                      data-pendo="button-remove-tag"
                      data-tag-name={tag}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              ) : (
                <span className="inline-block bg-[#e3cac0] text-[#263d57]/70 px-2 py-1 rounded-md text-sm">
                  #uncategorized (will be added if no tags)
                </span>
              )}
            </div>
            
            <div className="mt-3 flex gap-2">
              <Input
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add new hashtag..."
                className="flex-1 bg-white border-[#e3cac0] focus:border-[#b95827]"
                data-testid="input-new-hashtag"
                data-pendo="input-new-hashtag"
              />
              <Button
                onClick={handleAddTag}
                variant="outline"
                className="border-[#b95827] text-[#b95827] hover:bg-[#b95827] hover:text-white"
                data-testid="button-add-hashtag"
                data-pendo="button-add-hashtag"
              >
                Add
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-[#263d57]/70">
            <p><strong>Tip:</strong> Click the X to remove a hashtag, or type a new one to add it to your boards.</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={updateMessageMutation.isPending}
            className="border-[#e3cac0] hover:bg-[#e3cac0]"
            data-testid="button-cancel"
            data-pendo="modal-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMessageMutation.isPending}
            className="bg-[#b95827] hover:bg-[#a04d1f]"
            data-testid="button-update-message"
            data-pendo="modal-save-btn"
          >
            {updateMessageMutation.isPending ? "Updating..." : "Update Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
