import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, Contact } from "lucide-react";

interface InviteFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userDisplayName: string;
}

export function InviteFriendsModal({ isOpen, onClose, userDisplayName }: InviteFriendsModalProps) {
  const [name, setName] = useState(userDisplayName);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [supportsContactPicker, setSupportsContactPicker] = useState(false);
  const { toast } = useToast();

  // Check if Contact Picker API is supported
  useEffect(() => {
    setSupportsContactPicker('contacts' in navigator && 'ContactsManager' in window);
  }, []);

  // Update name when userDisplayName changes
  useEffect(() => {
    setName(userDisplayName);
  }, [userDisplayName]);

  const inviteMutation = useMutation({
    mutationFn: async ({ name, phoneNumber }: { name: string; phoneNumber: string }) => {
      const response = await apiRequest("/api/invite", {
        method: "POST",
        body: JSON.stringify({ name, phoneNumber }),
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        description: "Invitation sent successfully!",
      });
      onClose();
      setPhoneNumber("");
      setName(userDisplayName);
    },
    onError: (error: any) => {
      toast({
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }
    
    if (!phoneNumber.trim()) {
      toast({
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }
    
    // Basic phone number validation (10-11 digits)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      toast({
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }
    
    inviteMutation.mutate({ name: name.trim(), phoneNumber: phoneNumber.trim() });
  };

  const handleContactPicker = async () => {
    try {
      const props = ['tel'];
      const opts = { multiple: false };
      // @ts-ignore - Contact Picker API is not in TypeScript types yet
      const contacts = await navigator.contacts.select(props, opts);
      
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        if (contact.tel && contact.tel.length > 0) {
          setPhoneNumber(contact.tel[0]);
        }
      }
    } catch (error) {
      console.error('Contact picker error:', error);
      toast({
        description: "Could not access contacts",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setPhoneNumber("");
    setName(userDisplayName);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#fff2ea] border-[#e3cac0]" data-pendo="modal-invite-friends">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Friends
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Send your friends an invitation to join Aside via text message.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviterName">Your Name</Label>
            <Input
              id="inviterName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full"
              disabled={inviteMutation.isPending}
              data-testid="input-inviter-name"
              data-pendo="input-inviter-name"
            />
            <p className="text-sm text-muted-foreground">
              They'll see who the invite is from.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Friend's Phone Number</Label>
            <div className="flex gap-2">
              <Input
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="(555) 123-4567"
                className="flex-1"
                disabled={inviteMutation.isPending}
                data-testid="input-friend-phone"
                data-pendo="input-friend-phone"
              />
              {supportsContactPicker && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleContactPicker}
                  disabled={inviteMutation.isPending}
                  className="flex-shrink-0"
                  data-testid="button-pick-contact"
                  data-pendo="button-pick-contact"
                  title="Pick from contacts"
                >
                  <Contact className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              We'll send them a text message invitation.
            </p>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={inviteMutation.isPending}
              data-testid="button-cancel-invite"
              data-pendo="modal-cancel-btn"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={inviteMutation.isPending || !name.trim() || !phoneNumber.trim()}
              className="bg-[#b95827] hover:bg-[#a04d1f] text-white"
              data-testid="button-send-invite"
              data-pendo="modal-send-invite-btn"
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
