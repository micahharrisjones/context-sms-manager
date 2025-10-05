import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { pendo } from '@/lib/pendo';

interface AddMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddMessageModal({ isOpen, onClose }: AddMessageModalProps) {
  const [content, setContent] = useState('');
  const [hashtags, setHashtags] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addMessageMutation = useMutation({
    mutationFn: async (data: { content: string; hashtags: string }) => {
      const messageContent = data.hashtags.trim() 
        ? `${data.content} ${data.hashtags.split(',').map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`).join(' ')}`
        : data.content;

      const response = await apiRequest('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ 
          content: messageContent,
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
        has_hashtags: hashtags.trim().length > 0,
        hashtag_count: hashtags.trim() ? hashtags.split(',').length : 0,
        has_url: /https?:\/\/[^\s]+/.test(content),
        message_length: content.length,
        platform: 'web'
      });
      
      toast({
        title: "Message added",
        description: "Your message has been added to Context.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      setContent('');
      setHashtags('');
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
    addMessageMutation.mutate({ content: content.trim(), hashtags: hashtags.trim() });
  };

  const handleClose = () => {
    if (!addMessageMutation.isPending) {
      setContent('');
      setHashtags('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Add to Context</DialogTitle>
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
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hashtags">Tags (optional)</Label>
            <Input
              id="hashtags"
              placeholder="work, ideas, quotes (comma separated)"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              disabled={addMessageMutation.isPending}
            />
            <p className="text-sm text-[#263d57]/70">
              Separate multiple tags with commas. The # symbol will be added automatically.
            </p>
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