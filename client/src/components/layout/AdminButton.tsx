import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminButtonProps {
  onClose?: () => void;
  location: string;
}

export function AdminButton({ onClose, location }: AdminButtonProps) {
  // Check if current user has admin access by trying to fetch admin stats
  const { data: hasAdminAccess } = useQuery({
    queryKey: ['/api/admin/stats'],
    retry: false,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    meta: {
      errorBoundary: false,
    },
  });

  // Fetch unread feedback count
  const { data: unreadFeedbackData } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/feedback/unread-count'],
    retry: false,
    enabled: !!hasAdminAccess, // Only fetch if user has admin access
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Only render the admin button if the user has admin access
  if (!hasAdminAccess) {
    return null;
  }

  const unreadCount = unreadFeedbackData?.count || 0;

  return (
    <Link href="/admin" data-pendo="link-admin-panel">
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start text-[#263d57]/70 hover:text-blue-600 hover:bg-[#e3cac0]/20",
          location === "/admin" && "bg-[#e3cac0]/30 text-blue-600"
        )}
        onClick={onClose}
        data-pendo="button-admin-panel"
      >
        <Settings className="h-4 w-4 mr-2" />
        Admin Panel
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="ml-auto bg-red-500 text-white"
            data-testid="badge-unread-feedback"
          >
            {unreadCount}
          </Badge>
        )}
      </Button>
    </Link>
  );
}