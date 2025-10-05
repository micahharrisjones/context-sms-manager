import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InviteToPrivateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardName: string;
}

export function InviteToPrivateBoardModal({ isOpen, onClose, boardName }: InviteToPrivateBoardModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const convertAndInviteMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await apiRequest(`/api/private-boards/${encodeURIComponent(boardName)}/convert-and-invite`, {
        method: "POST",
        body: JSON.stringify({ phoneNumber }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Board Converted & Invitation Sent",
        description: data.message || `#${boardName} is now a shared board and ${phoneNumber} has been invited!`,
      });
      
      // Refresh the data to show the new shared board
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shared-boards"] });
      
      onClose();
      setPhoneNumber("");
    },
    onError: (error: any) => {
      toast({
        title: "Conversion Failed",
        description: error.message || "Failed to convert private board to shared board",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a phone number to invite",
        variant: "destructive",
      });
      return;
    }
    convertAndInviteMutation.mutate(phoneNumber.trim());
  };

  const handleClose = () => {
    setPhoneNumber("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#fff2ea] border-[#e3cac0]">
        <DialogHeader>
          <DialogTitle>Convert #{boardName} to Shared Board</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              This will convert your private board <strong>#{boardName}</strong> into a shared board and invite the user you specify.
            </p>
            <p className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
              <strong>Note:</strong> Once converted to a shared board, this board will appear in the "Shared Boards" section and can be accessed by all invited members.
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Invite User by Phone Number</Label>
              <Input
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter phone number (e.g., 6155551234)"
                className="w-full"
                disabled={convertAndInviteMutation.isPending}
              />
              <p className="text-sm text-muted-foreground">
                The user must have a Context account with this phone number to receive the invitation.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={convertAndInviteMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={convertAndInviteMutation.isPending || !phoneNumber.trim()}
              >
                {convertAndInviteMutation.isPending ? "Converting..." : "Convert & Invite"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}