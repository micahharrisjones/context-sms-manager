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
        description: data.message || `Successfully invited ${phoneNumber} to #${boardName}`,
      });
      onClose();
      setPhoneNumber("");
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
    if (!phoneNumber.trim()) {
      toast({
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }
    inviteUserMutation.mutate(phoneNumber.trim());
  };

  const handleClose = () => {
    setPhoneNumber("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#fff3ea] border-[#e3cac0]">
        <DialogHeader>
          <DialogTitle>Invite to #{boardName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter phone number (e.g., 6155551234)"
              className="w-full"
              disabled={inviteUserMutation.isPending}
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
              disabled={inviteUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={inviteUserMutation.isPending || !phoneNumber.trim()}
            >
              {inviteUserMutation.isPending ? "Inviting..." : "Send Invite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}