import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, ArrowLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { SharedBoard, NotificationPreference } from "@shared/schema";

interface BoardWithNotification extends SharedBoard {
  role: string;
  smsEnabled: boolean;
}

export function NotificationSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch shared boards
  const { data: sharedBoards = [], isLoading: boardsLoading } = useQuery<(SharedBoard & { role: string })[]>({
    queryKey: ['/api/shared-boards'],
  });

  // Fetch notification preferences
  const { data: preferences = [], isLoading: preferencesLoading } = useQuery<NotificationPreference[]>({
    queryKey: ['/api/notification-preferences'],
  });

  // Combine boards with their notification settings
  const boardsWithNotifications: BoardWithNotification[] = sharedBoards.map(board => {
    const preference = preferences.find(p => p.boardId === board.id);
    return {
      ...board,
      smsEnabled: preference ? preference.smsEnabled === "true" : true // Default to enabled
    };
  });

  // Update notification preference mutation
  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ boardId, smsEnabled }: { boardId: number; smsEnabled: boolean }) => {
      return apiRequest(`/api/notification-preferences/${boardId}`, {
        method: 'PUT',
        body: JSON.stringify({ smsEnabled }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-preferences'] });
      toast({
        title: "Settings updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update notification settings",
        variant: "destructive",
      });
    },
  });

  const handleToggleNotification = (boardId: number, currentEnabled: boolean) => {
    updatePreferenceMutation.mutate({
      boardId,
      smsEnabled: !currentEnabled
    });
  };

  if (boardsLoading || preferencesLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Messages
        </Button>
      </Link>
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
        <p className="text-gray-600">Manage SMS notifications for your shared boards</p>
      </div>

      {/* Overall Status */}
      <Card className="border-[#e3cac0]">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-[#ed2024]" />
            <div>
              <p className="font-medium">SMS Notifications</p>
              <p className="text-sm text-gray-600">
                You'll receive SMS notifications when someone adds content to shared boards where notifications are enabled.
                You can still receive notifications from Context updates by texting the main number.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Board Settings */}
      <Card className="border-[#e3cac0]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Shared Board Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {boardsWithNotifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BellOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>You're not a member of any shared boards yet.</p>
              <p className="text-sm mt-1">Join or create a shared board to manage notifications.</p>
            </div>
          ) : (
            boardsWithNotifications.map((board) => (
              <div key={board.id} className="flex items-center justify-between p-4 border border-[#e3cac0] rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900">#{board.name}</h3>
                    <Badge variant={board.role === "owner" ? "default" : "secondary"} className="text-xs">
                      {board.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {board.smsEnabled 
                      ? "You'll receive SMS notifications when new content is added" 
                      : "SMS notifications are disabled for this board"
                    }
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`notification-${board.id}`}
                    checked={board.smsEnabled}
                    onCheckedChange={() => handleToggleNotification(board.id, board.smsEnabled)}
                    disabled={updatePreferenceMutation.isPending}
                  />
                  <Label htmlFor={`notification-${board.id}`} className="sr-only">
                    Toggle notifications for {board.name}
                  </Label>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="border-[#e3cac0] bg-[#fff3ea]">
        <CardContent className="pt-6">
          <div className="text-sm text-gray-700 space-y-2">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>When someone adds content to a shared board, all members with notifications enabled receive an SMS</li>
              <li>You won't receive notifications for content you add yourself</li>
              <li>Disabling notifications for a board only affects SMS alerts - you'll still see new content in the app</li>
              <li>These settings don't affect direct messages to the Context phone number</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}