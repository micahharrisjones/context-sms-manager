import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Search, User, Phone } from "lucide-react";

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardName: string;
}

interface SearchUser {
  id: number;
  phoneNumber: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export function InviteUserModal({ isOpen, onClose, boardName }: InviteUserModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const { toast } = useToast();

  // Search for users
  const { data: searchResults = [] } = useQuery<SearchUser[]>({
    queryKey: ['/api/users/search', searchQuery],
    enabled: searchQuery.length >= 2 && !isManualEntry,
    queryFn: async () => {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      return response.json();
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await apiRequest(`/api/shared-boards/${encodeURIComponent(boardName)}/invite`, {
        method: "POST",
        body: JSON.stringify({ phoneNumber }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      const userName = selectedUser ? getDisplayName(selectedUser) : phoneNumber;
      toast({
        description: data.message || `Successfully invited ${userName} to #${boardName}`,
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

  const getDisplayName = (user: SearchUser) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.displayName || user.phoneNumber;
  };

  const getInitials = (user: SearchUser) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.displayName?.[0]?.toUpperCase() || user.phoneNumber[0] || 'U';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPhoneNumber = selectedUser ? selectedUser.phoneNumber : phoneNumber.trim();
    
    if (!targetPhoneNumber) {
      toast({
        description: isManualEntry ? "Phone number is required" : "Please select a user",
        variant: "destructive",
      });
      return;
    }
    inviteUserMutation.mutate(targetPhoneNumber);
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedUser(null);
    setIsManualEntry(false);
    setPhoneNumber("");
    onClose();
  };

  const handleUserSelect = (user: SearchUser) => {
    setSelectedUser(user);
    setSearchQuery(getDisplayName(user));
  };

  const toggleManualEntry = () => {
    setIsManualEntry(!isManualEntry);
    setSearchQuery("");
    setSelectedUser(null);
    setPhoneNumber("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#fff3ea] border-[#e3cac0]">
        <DialogHeader>
          <DialogTitle>Invite to #{boardName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{isManualEntry ? "Phone Number" : "Search Users"}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleManualEntry}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                {isManualEntry ? "Search by name" : "Enter phone directly"}
              </Button>
            </div>
            
            {isManualEntry ? (
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter phone number (e.g., 6155551234)"
                className="w-full border-[#e3cac0] focus:border-[#ed2024]"
                disabled={inviteUserMutation.isPending}
              />
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedUser) setSelectedUser(null);
                  }}
                  placeholder="Search by name or phone number..."
                  className="w-full pl-10 border-[#e3cac0] focus:border-[#ed2024]"
                  disabled={inviteUserMutation.isPending}
                />
                
                {/* Search Results */}
                {searchQuery.length >= 2 && !selectedUser && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-[#e3cac0] rounded-md shadow-lg max-h-60 overflow-auto">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleUserSelect(user)}
                        className="w-full p-3 text-left hover:bg-[#fff3ea] flex items-center gap-3"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatarUrl} alt={getDisplayName(user)} />
                          <AvatarFallback className="bg-[#ed2024] text-white text-xs">
                            {getInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{getDisplayName(user)}</div>
                          <div className="text-sm text-muted-foreground">{user.phoneNumber}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Selected User Display */}
                {selectedUser && (
                  <div className="mt-2 p-3 bg-[#fff3ea] border border-[#e3cac0] rounded-md flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedUser.avatarUrl} alt={getDisplayName(selectedUser)} />
                      <AvatarFallback className="bg-[#ed2024] text-white text-xs">
                        {getInitials(selectedUser)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{getDisplayName(selectedUser)}</div>
                      <div className="text-sm text-muted-foreground">{selectedUser.phoneNumber}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(null);
                        setSearchQuery("");
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              The user must have a Context account to receive the invitation.
            </p>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={inviteUserMutation.isPending}
              className="border-[#e3cac0] hover:bg-[#fff3ea]"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={inviteUserMutation.isPending || (!selectedUser && !phoneNumber.trim())}
              className="bg-[#ed2024] hover:bg-[#d1001a] text-white"
            >
              {inviteUserMutation.isPending ? "Inviting..." : "Send Invite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}