import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { pendo } from '@/lib/pendo';
import { X } from 'lucide-react';

interface AddMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTag?: string;
}

export function AddMessageModal({ isOpen, onClose, currentTag }: AddMessageModalProps) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pre-populate tags with currentTag when modal opens, reset when it closes
  useEffect(() => {
    if (isOpen) {
      console.log("AddMessageModal opened with currentTag:", currentTag);
      if (currentTag) {
        console.log("Setting tags to:", [currentTag]);
        setTags([currentTag]);
      } else {
        console.log("No currentTag, setting empty tags");
        setTags([]);
      }
    } else {
      // Reset state when modal closes
      setTags([]);
      setContent('');
      setNewHashtag('');
    }
  }, [isOpen, currentTag]);

  const addMessageMutation = useMutation({
    mutationFn: async (data: { content: string; tags: string[] }) => {
      const finalTags = data.tags.length === 0 ? ["uncategorized"] : data.tags;
      
      const response = await apiRequest('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ 
          content: data.content,
          tags: finalTags,
          source: 'ui'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add message');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Track message creation success
      pendo.track('Message Created', {
        message_source: 'ui',
        has_hashtags: tags.length > 0,
        hashtag_count: tags.length,
        has_url: /https?:\/\/[^\s]+/.test(content),
        message_length: content.length,
        platform: 'web'
      });
      
      toast({
        title: "Message added",
        description: "Your message has been added to Aside.",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message.",
        variant: "destructive",
      });
      return;
    }
    
    // If no tags and we have a currentTag, use it
    const finalTags = tags.length === 0 && currentTag ? [currentTag] : tags;
    console.log("Submitting message with tags:", finalTags, "from state tags:", tags, "currentTag:", currentTag);
    addMessageMutation.mutate({ content: content.trim(), tags: finalTags });
  };

  const handleClose = () => {
    if (!addMessageMutation.isPending) {
      onClose();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleAddTag = () => {
    const trimmedTag = newHashtag.trim().replace(/^#+/, '');
    if (trimmedTag === "") return;
    
    if (tags.includes(trimmedTag)) {
      toast({
        title: "Duplicate Tag",
        description: "This hashtag is already added.",
        variant: "destructive",
      });
      setNewHashtag("");
      return;
    }
    
    setTags([...tags, trimmedTag]);
    setNewHashtag("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#fff2ea] border-[#e3cac0]">
        <DialogHeader>
          <DialogTitle className="text-center">Add to Aside</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Message</Label>
            <Textarea
              id="content"
              placeholder="Enter your message..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={addMessageMutation.isPending}
              rows={4}
              className="resize-none bg-white border-[#e3cac0] focus:border-[#b95827]"
            />
          </div>

          <div className="bg-white p-3 rounded-md border border-[#e3cac0]">
            <Label className="text-sm font-medium text-[#263d57]/80">
              Boards:
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.length > 0 ? (
                tags.map((tag) => (
                  <div
                    key={tag}
                    className="inline-flex items-center gap-1 bg-[#b95827]/10 text-[#b95827] px-2 py-1 rounded-md text-sm group hover:bg-[#b95827]/20 transition-colors"
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:bg-[#b95827]/30 rounded-full p-0.5 transition-colors"
                      aria-label={`Remove ${tag} tag`}
                      type="button"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              ) : (
                <span className="inline-block bg-[#e3cac0] text-[#263d57]/70 px-2 py-1 rounded-md text-sm">
                  {currentTag ? `#${currentTag} (will be added if no tags)` : '#uncategorized (will be added if no tags)'}
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
                disabled={addMessageMutation.isPending}
              />
              <Button
                onClick={handleAddTag}
                variant="outline"
                type="button"
                className="border-[#b95827] text-[#b95827] hover:bg-[#b95827] hover:text-white"
                disabled={addMessageMutation.isPending}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={addMessageMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addMessageMutation.isPending || !content.trim()}
              className="flex-1 bg-[#b95827] hover:bg-[#a04d1f]"
            >
              {addMessageMutation.isPending ? "Adding..." : "Add Message"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}