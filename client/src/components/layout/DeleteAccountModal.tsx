import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const [confirmation, setConfirmation] = useState("");
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const deleteAccountMutation = useMutation({
    mutationFn: () => apiRequest("/api/auth/delete-account", {
      method: "DELETE",
    }),
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been permanently deleted.",
      });
      // Close the modal first
      onClose();
      // Logout will automatically redirect to login via page refresh
      logout();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (confirmation !== "DELETE") {
      toast({
        title: "Incorrect confirmation",
        description: "Please type 'DELETE' exactly to confirm account deletion.",
        variant: "destructive",
      });
      return;
    }

    deleteAccountMutation.mutate();
  };

  const handleClose = () => {
    if (deleteAccountMutation.isPending) return;
    setConfirmation("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#fff3ea] border-[#e3cac0]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription className="text-gray-700">
            This action cannot be undone. Your account and all associated data will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">What will be deleted:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Your account and profile</li>
                <li>• All your messages and content</li>
                <li>• All private boards you created</li>
                <li>• Your membership in shared boards</li>
                <li>• All associated data</li>
              </ul>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmation" className="text-gray-700">
                Type <span className="font-mono font-bold">DELETE</span> to confirm:
              </Label>
              <Input
                id="confirmation"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="Type DELETE here"
                className="border-[#e3cac0] bg-white"
                disabled={deleteAccountMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={deleteAccountMutation.isPending}
              className="border-[#e3cac0] hover:bg-[#e3cac0]/30"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={confirmation !== "DELETE" || deleteAccountMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteAccountMutation.isPending ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}