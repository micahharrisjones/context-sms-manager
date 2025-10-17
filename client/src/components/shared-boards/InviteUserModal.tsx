import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardName: string;
}

export function InviteUserModal({ isOpen, onClose, boardName }: InviteUserModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const { toast } = useToast();

  const inviteUserMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await apiRequest(`/api/shared-boards/${encodeURIComponent(boardName)}/invite`, {
        method: "POST",
        body: JSON.stringify({ phoneNumber }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        description: data.message || `Successfully invited user to #${boardName}`,
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        description: error.message || "Failed to invite user",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPhone = phoneNumber.trim();
    
    if (!trimmedPhone) {
      toast({
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }
    inviteUserMutation.mutate(trimmedPhone);
  };

  const handleClose = () => {
    setPhoneNumber("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#fff2ea] border-[#e3cac0]" onInteractOutside={(e) => e.preventDefault()} data-pendo="modal-invite-user">
        <DialogHeader>
          <DialogTitle>Invite to #{boardName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone-number">Enter phone number</Label>
            <Input
              id="phone-number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter phone number (e.g., 6155551234)"
              className="w-full border-[#e3cac0] focus:border-[#b95827]"
              disabled={inviteUserMutation.isPending}
              data-pendo="input-invite-phone-number"
            />
            
            <p className="text-sm text-muted-foreground">
              The user must have an Aside account to receive the invitation.
            </p>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={inviteUserMutation.isPending}
              className="border-[#e3cac0] hover:bg-[#fff2ea]"
              data-pendo="modal-cancel-btn"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={inviteUserMutation.isPending || !phoneNumber.trim()}
              className="bg-[#b95827] hover:bg-[#a04d1f] text-white"
              data-pendo="modal-save-btn"
            >
              {inviteUserMutation.isPending ? "Inviting..." : "Send Invite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
