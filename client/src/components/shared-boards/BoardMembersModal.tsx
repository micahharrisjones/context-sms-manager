import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { Users, Phone } from "lucide-react";

interface BoardMember {
  id: number;
  userId: number;
  boardId: number;
  role: string;
  joinedAt: string;
  user: {
    id: number;
    phoneNumber: string;
    displayName: string;
    createdAt: string;
    lastLoginAt: string | null;
  };
}

interface BoardMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardName: string;
}

export function BoardMembersModal({ isOpen, onClose, boardName }: BoardMembersModalProps) {
  const { data: members, isLoading, error } = useQuery<BoardMember[]>({
    queryKey: [`/api/shared-boards/${boardName}/members`],
    enabled: isOpen && !!boardName,
  });

  // Debug logging
  console.log('BoardMembersModal:', { isOpen, boardName, members, isLoading, error });

  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    // Remove any non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX if 10 digits, otherwise show as-is
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  // Get display name from profile or fallback to phone
  const getDisplayName = (user: BoardMember['user']) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.displayName || formatPhoneNumber(user.phoneNumber);
  };

  // Get initials for avatar
  const getInitials = (user: BoardMember['user']) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.displayName?.[0]?.toUpperCase() || user.phoneNumber[0] || 'U';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#fff3ea] border-[#e3cac0]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Board Members - {boardName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading members...</p>
            </div>
          ) : error ? (
            <div className="text-center py-6">
              <p className="text-sm text-red-600">Error loading members: {String(error)}</p>
            </div>
          ) : !members || members.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No members found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.user?.avatarUrl} alt={getDisplayName(member.user)} />
                      <AvatarFallback className="bg-[#ed2024] text-white text-sm">
                        {getInitials(member.user)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {member.user ? getDisplayName(member.user) : 'Unknown User'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member.user?.firstName && member.user?.lastName ? (
                          formatPhoneNumber(member.user.phoneNumber)
                        ) : (
                          `Joined ${new Date(member.joinedAt).toLocaleDateString()}`
                        )}
                      </div>
                      {member.user?.firstName && member.user?.lastName && (
                        <div className="text-xs text-muted-foreground">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium capitalize text-primary">
                      {member.role}
                    </div>
                    {member.user?.lastLoginAt && (
                      <div className="text-xs text-muted-foreground">
                        Last active: {new Date(member.user.lastLoginAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}