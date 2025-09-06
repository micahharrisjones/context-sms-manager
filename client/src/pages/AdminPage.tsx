import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Users, MessageSquare, Hash, Database, Settings, Send, MessageCircle, Edit3, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AdminUser {
  id: number;
  phoneNumber: string;
  displayName: string;
  createdAt: string;
  messageCount: number;
  lastActivity: string | null;
}

interface AdminStats {
  totalUsers: number;
  totalMessages: number;
  totalSharedBoards: number;
  recentSignups: number;
}

interface FeedbackMessage {
  id: number;
  content: string;
  senderId: string;
  userId: number;
  timestamp: string;
  tags: string[];
  mediaUrl?: string;
  mediaType?: string;
}

interface OnboardingMessage {
  id: number;
  step: string;
  title: string;
  content: string;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

export function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [bulkSmsMessage, setBulkSmsMessage] = useState("");
  const [showBulkSmsModal, setShowBulkSmsModal] = useState(false);
  
  // Onboarding message editing state
  const [editingMessage, setEditingMessage] = useState<OnboardingMessage | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    isActive: "true"
  });

  // Fetch admin stats
  const { data: stats, error: statsError } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    retry: false
  });

  // Fetch all users with admin info
  const { data: users, isLoading: usersLoading, error: usersError } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
    retry: false
  });

  // Fetch feedback messages
  const { data: feedbackMessages, isLoading: feedbackLoading, error: feedbackError } = useQuery<FeedbackMessage[]>({
    queryKey: ['/api/admin/feedback'],
    retry: false
  });

  // Fetch onboarding messages
  const { data: onboardingMessages, isLoading: onboardingLoading, error: onboardingError } = useQuery<OnboardingMessage[]>({
    queryKey: ['/api/admin/onboarding-messages'],
    retry: false
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "User deleted",
        description: "User and all associated data have been removed."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed", 
        description: error.message || "Failed to delete user",
        variant: "destructive"
      });
    }
  });

  // Bulk delete users mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: number[]) => {
      return apiRequest('/api/admin/users/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ userIds })
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      setSelectedUsers([]);
      toast({
        title: "Users deleted",
        description: `Successfully deleted ${data.deletedCount} users and their associated data.`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk delete failed",
        description: error.message || "Failed to delete users",
        variant: "destructive"
      });
    }
  });

  // Bulk SMS broadcast mutation
  const bulkSmsMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest('/api/admin/broadcast-sms', {
        method: 'POST',
        body: JSON.stringify({ message })
      });
    },
    onSuccess: (data: any) => {
      setShowBulkSmsModal(false);
      setBulkSmsMessage("");
      toast({
        title: "SMS broadcast sent",
        description: `Message sent to ${data.successful} users (${data.failed} failed)`
      });
    },
    onError: (error: any) => {
      toast({
        title: "SMS broadcast failed",
        description: error.message || "Failed to send SMS broadcast",
        variant: "destructive"
      });
    }
  });

  // Update onboarding message mutation
  const updateOnboardingMessageMutation = useMutation({
    mutationFn: async ({ step, data }: { step: string; data: { title: string; content: string; isActive: string } }) => {
      return apiRequest(`/api/admin/onboarding-messages/${step}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/onboarding-messages'] });
      toast({
        title: "Message Updated",
        description: "Onboarding message has been updated successfully.",
      });
      setEditingMessage(null);
      setEditForm({ title: "", content: "", isActive: "true" });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update onboarding message",
        variant: "destructive",
      });
    },
  });

  // Seed onboarding messages mutation
  const seedOnboardingMessagesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/seed-onboarding', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/onboarding-messages'] });
      toast({
        title: "Messages Seeded",
        description: "Onboarding messages have been seeded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Seeding Failed",
        description: error.message || "Failed to seed onboarding messages",
        variant: "destructive",
      });
    },
  });

  const handleDeleteUser = (userId: number) => {
    deleteUserMutation.mutate(userId);
  };

  const handleBulkDelete = () => {
    if (selectedUsers.length === 0) return;
    bulkDeleteMutation.mutate(selectedUsers);
  };

  const handleBulkSms = () => {
    if (!bulkSmsMessage.trim()) return;
    bulkSmsMutation.mutate(bulkSmsMessage.trim());
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    if (!users) return;
    setSelectedUsers(users.map(u => u.id));
  };

  const clearSelection = () => {
    setSelectedUsers([]);
  };

  // Onboarding message handlers
  const handleEditMessage = (message: OnboardingMessage) => {
    setEditingMessage(message);
    setEditForm({
      title: message.title,
      content: message.content,
      isActive: message.isActive
    });
  };

  const handleUpdateMessage = () => {
    if (!editingMessage) return;
    updateOnboardingMessageMutation.mutate({
      step: editingMessage.step,
      data: editForm
    });
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditForm({ title: "", content: "", isActive: "true" });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check for admin access errors
  if (statsError || usersError) {
    const errorMessage = (statsError as any)?.message || (usersError as any)?.message || "Access denied";
    if (errorMessage.includes("Admin access required") || errorMessage.includes("403")) {
      return (
        <div className="p-6 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-red-600 mb-4">
              <Settings className="h-12 w-12 mx-auto mb-2" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600">
              You don't have permission to access the admin dashboard.
            </p>
          </div>
        </div>
      );
    }
  }

  if (usersLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
        <Badge variant="outline" className="text-xs">
          Admin Access
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMessages || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shared Boards</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSharedBoards || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Signups (7d)</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recentSignups || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user accounts and associated data. Use caution when deleting users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Bulk Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllUsers}
              disabled={!users || users.length === 0}
            >
              Select All ({users?.length || 0})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={selectedUsers.length === 0}
            >
              Clear Selection
            </Button>
            
            {/* Bulk SMS Button */}
            <Dialog open={showBulkSmsModal} onOpenChange={setShowBulkSmsModal}>
              <DialogTrigger asChild>
                <Button 
                  variant="default" 
                  size="sm"
                  className="bg-[#ed2024] hover:bg-[#d01d21] text-white"
                >
                  <Send className="h-4 w-4 mr-2" />
                  SMS All Users
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px] bg-[#fff3ea] border-[#e3cac0]">
                <DialogHeader>
                  <DialogTitle>Send SMS Broadcast</DialogTitle>
                  <DialogDescription>
                    Send a message to all {users?.length || 0} Context users. Use this for product updates, release notes, and important announcements (not advertising).
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Textarea
                    placeholder="Type your message here... (max 1600 characters)"
                    value={bulkSmsMessage}
                    onChange={(e) => setBulkSmsMessage(e.target.value)}
                    rows={6}
                    maxLength={1600}
                    className="resize-none border-[#e3cac0] focus:border-[#ed2024] focus:ring-[#ed2024]"
                  />
                  <div className="text-sm text-gray-500 text-right">
                    {bulkSmsMessage.length}/1600 characters
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowBulkSmsModal(false)}
                    className="border-[#e3cac0] hover:bg-[#e3cac0]/20"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleBulkSms} 
                    disabled={!bulkSmsMessage.trim() || bulkSmsMutation.isPending}
                    className="bg-[#ed2024] hover:bg-[#d01d21] text-white"
                  >
                    {bulkSmsMutation.isPending ? "Sending..." : `Send to ${users?.length || 0} users`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedUsers.length === 0}
                  className="sm:ml-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedUsers.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#fff3ea] border-[#e3cac0]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedUsers.length} Users</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {selectedUsers.length} users and all their associated data including messages, board memberships, and shared boards. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Users
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Users Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead className="min-w-[60px]">ID</TableHead>
                  <TableHead className="min-w-[120px]">Phone</TableHead>
                  <TableHead className="min-w-[100px]">Name</TableHead>
                  <TableHead className="min-w-[80px]">Msgs</TableHead>
                  <TableHead className="min-w-[100px] hidden sm:table-cell">Created</TableHead>
                  <TableHead className="min-w-[100px] hidden md:table-cell">Last Active</TableHead>
                  <TableHead className="min-w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users && users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{user.id}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="sm:hidden">
                          {user.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}
                        </div>
                        <div className="hidden sm:block">{user.phoneNumber}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="truncate max-w-[100px]">{user.displayName}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.messageCount > 0 ? "default" : "secondary"} className="text-xs">
                          {user.messageCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                        <div className="truncate">{formatDate(user.createdAt)}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                        <div className="truncate">{user.lastActivity ? formatDate(user.lastActivity) : 'Never'}</div>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deleteUserMutation.isPending}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#fff3ea] border-[#e3cac0]">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User {user.displayName}</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete user {user.phoneNumber} and all associated data including {user.messageCount} messages, board memberships, and shared boards. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete User
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Messages Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Onboarding Messages
              </CardTitle>
              <CardDescription>
                Customize the SMS messages sent during the onboarding flow for new users.
              </CardDescription>
            </div>
            {(!onboardingMessages || onboardingMessages.length === 0) && (
              <Button
                onClick={() => seedOnboardingMessagesMutation.mutate()}
                disabled={seedOnboardingMessagesMutation.isPending}
                className="bg-[#ed2024] hover:bg-[#d11d20] text-white"
              >
                {seedOnboardingMessagesMutation.isPending ? "Seeding..." : "Seed Messages"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {onboardingLoading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : onboardingError ? (
            <div className="text-center text-muted-foreground py-8">
              <Smartphone className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>Failed to load onboarding messages</p>
            </div>
          ) : onboardingMessages && onboardingMessages.length > 0 ? (
            <div className="space-y-4">
              {onboardingMessages.map((message) => (
                <div key={message.id} className="border rounded-lg p-4 bg-[#fff3ea] border-[#e3cac0]">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {message.step.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge variant={message.isActive === "true" ? "default" : "secondary"} className="text-xs">
                        {message.isActive === "true" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditMessage(message)}
                      className="h-8 w-8 p-0 hover:bg-[#e3cac0]"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="mb-2">
                    <h4 className="text-sm font-medium">{message.title}</h4>
                  </div>
                  <div className="text-sm bg-white p-3 rounded border-[#e3cac0] border">
                    {message.content}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Last updated: {formatDate(message.updatedAt)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Smartphone className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No onboarding messages found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Onboarding Message Dialog */}
      <Dialog open={!!editingMessage} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="bg-[#fff3ea] border-[#e3cac0] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Onboarding Message</DialogTitle>
            <DialogDescription>
              Update the {editingMessage?.step.replace('_', ' ')} message for the onboarding flow.
            </DialogDescription>
          </DialogHeader>
          {editingMessage && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Display Title</Label>
                <Input
                  id="title"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter a descriptive title..."
                  className="bg-white border-[#e3cac0]"
                />
              </div>
              <div>
                <Label htmlFor="content">SMS Message Content</Label>
                <Textarea
                  id="content"
                  value={editForm.content}
                  onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter the SMS message content..."
                  rows={6}
                  className="bg-white border-[#e3cac0]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Character count: {editForm.content.length}/1600
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editForm.isActive === "true"}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isActive: checked ? "true" : "false" }))}
                />
                <Label htmlFor="isActive">Message is active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateMessage}
              disabled={updateOnboardingMessageMutation.isPending || !editForm.title.trim() || !editForm.content.trim()}
              className="bg-[#ed2024] hover:bg-[#d01d21] text-white"
            >
              {updateOnboardingMessageMutation.isPending ? "Updating..." : "Update Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Feedback Messages
          </CardTitle>
          <CardDescription>
            View all feedback messages received from users via #feedback hashtag.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedbackLoading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : feedbackError ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>Failed to load feedback messages</p>
            </div>
          ) : feedbackMessages && feedbackMessages.length > 0 ? (
            <div className="space-y-4">
              {feedbackMessages.map((message) => (
                <div key={message.id} className="border rounded-lg p-4 bg-[#fff3ea] border-[#e3cac0]">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{message.tags.join(' #')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ID: {message.id}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(message.timestamp)}
                    </span>
                  </div>
                  <div className="mb-2">
                    <p className="text-sm font-medium">From: {message.senderId}</p>
                  </div>
                  <div className="text-sm bg-white p-3 rounded border-[#e3cac0] border">
                    {message.content}
                  </div>
                  {message.mediaUrl && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs">
                        Media: {message.mediaType}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No feedback messages yet</p>
              <p className="text-xs mt-1">Users can send feedback using #feedback in their messages</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}