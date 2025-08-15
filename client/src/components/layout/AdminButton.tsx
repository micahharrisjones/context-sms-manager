import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
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

  // Only render the admin button if the user has admin access
  if (!hasAdminAccess) {
    return null;
  }

  return (
    <Link href="/admin">
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start text-gray-600 hover:text-blue-600 hover:bg-[#e3cac0]/20",
          location === "/admin" && "bg-[#e3cac0]/30 text-blue-600"
        )}
        onClick={onClose}
      >
        <Settings className="h-4 w-4 mr-2" />
        Admin Panel
      </Button>
    </Link>
  );
}