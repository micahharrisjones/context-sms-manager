import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Users, MessageSquare, Hash, Database, Settings, Send, MessageCircle } from "lucide-react";
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


export function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [bulkSmsMessage, setBulkSmsMessage] = useState("");
  const [showBulkSmsModal, setShowBulkSmsModal] = useState(false);
  

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

  // Retroactive post enrichment mutation
  const enrichOldPostsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/enrich-old-posts', {
        method: 'POST'
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Posts enriched",
        description: `Successfully enriched ${data.processed} old posts with URL metadata (${data.skipped} skipped, ${data.errors} errors)`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Post enrichment failed",
        description: error.message || "Failed to enrich old posts",
        variant: "destructive"
      });
    }
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
            <p className="text-[#263d57]/70">
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
          <div className="h-8 bg-[#263d57]/10 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-[#263d57]/10 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-[#263d57]/10 rounded"></div>
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

      {/* Post Enrichment Card */}
      <Card className="bg-[#fff2ea] border-[#e3cac0]">
        <CardHeader>
          <CardTitle>Enrich Old Posts</CardTitle>
          <CardDescription>
            Retroactively fetch link previews (titles, descriptions, images) for old posts with URLs. This makes keyword search work properly by adding missing metadata to the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => enrichOldPostsMutation.mutate()}
            disabled={enrichOldPostsMutation.isPending}
            className="bg-[#b95827] hover:bg-[#a04d1f] text-white"
            data-testid="admin-button-enrich-old-posts"
          >
            <Database className="h-4 w-4 mr-2" />
            {enrichOldPostsMutation.isPending ? "Enriching Posts..." : "Enrich Old Posts with Link Previews"}
          </Button>
          {enrichOldPostsMutation.isPending && (
            <p className="text-sm text-[#263d57]/70 mt-2">
              This may take several minutes as each URL is fetched and processed...
            </p>
          )}
        </CardContent>
      </Card>

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
              data-pendo="admin-button-select-all"
            >
              Select All ({users?.length || 0})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={selectedUsers.length === 0}
              data-pendo="admin-button-clear-selection"
            >
              Clear Selection
            </Button>
            
            {/* Bulk SMS Button */}
            <Dialog open={showBulkSmsModal} onOpenChange={setShowBulkSmsModal}>
              <DialogTrigger asChild>
                <Button 
                  variant="default" 
                  size="sm"
                  className="bg-[#b95827] hover:bg-[#a04d1f] text-white"
                  data-pendo="admin-button-sms-all-users"
                >
                  <Send className="h-4 w-4 mr-2" />
                  SMS All Users
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px] bg-[#fff2ea] border-[#e3cac0]">
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
                    className="resize-none border-[#e3cac0] focus:border-[#b95827] focus:ring-[#b95827]"
                  />
                  <div className="text-sm text-[#263d57]/70 text-right">
                    {bulkSmsMessage.length}/1600 characters
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowBulkSmsModal(false)}
                    className="border-[#e3cac0] hover:bg-[#e3cac0]/20"
                    data-pendo="admin-button-cancel-sms"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleBulkSms} 
                    disabled={!bulkSmsMessage.trim() || bulkSmsMutation.isPending}
                    className="bg-[#b95827] hover:bg-[#a04d1f] text-white"
                    data-pendo="admin-button-send-sms"
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
                  data-pendo="admin-button-delete-selected"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedUsers.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#fff2ea] border-[#e3cac0]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedUsers.length} Users</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {selectedUsers.length} users and all their associated data including messages, board memberships, and shared boards. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-pendo="admin-button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-pendo="admin-button-confirm-delete-users"
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
                          className="h-4 w-4 rounded border-[#263d57]"
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
                              data-pendo="admin-button-delete-user"
                              data-user-id={user.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#fff2ea] border-[#e3cac0]">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User {user.displayName}</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete user {user.phoneNumber} and all associated data including {user.messageCount} messages, board memberships, and shared boards. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-pendo="admin-button-cancel-delete-user">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-pendo="admin-button-confirm-delete-user"
                                data-user-id={user.id}
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
                <div key={i} className="h-16 bg-[#263d57]/10 rounded"></div>
              ))}
            </div>
          ) : feedbackError ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-[#263d57]/50" />
              <p>Failed to load feedback messages</p>
            </div>
          ) : feedbackMessages && feedbackMessages.length > 0 ? (
            <div className="space-y-4">
              {feedbackMessages.map((message) => (
                <div key={message.id} className="border rounded-lg p-4 bg-[#fff2ea] border-[#e3cac0]">
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
              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-[#263d57]/50" />
              <p>No feedback messages yet</p>
              <p className="text-xs mt-1">Users can send feedback using #feedback in their messages</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pendo Cleanup */}
      <PendoCleanupCard />
    </div>
  );
}

interface CleanupResult {
  totalProcessed: number;
  totalDeleted: number;
  totalFailed: number;
  batches: number;
  errors: string[];
  dryRun: boolean;
}

function PendoCleanupCard() {
  const { toast } = useToast();
  const [csvContent, setCsvContent] = useState("");
  const parsedVisitorsRef = useRef<string[]>([]);
  const [parsedVisitorsCount, setParsedVisitorsCount] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  // Use ref to persist visitor IDs across renders
  const setParsedVisitors = (visitors: string[]) => {
    console.log('[Pendo Cleanup] setParsedVisitors called with:', visitors, 'length:', visitors.length);
    parsedVisitorsRef.current = visitors;
    setParsedVisitorsCount(visitors.length);
  };

  // Get current visitors from ref
  const parsedVisitors = parsedVisitorsRef.current;

  // Parse CSV mutation
  const parseCsvMutation = useMutation({
    mutationKey: ['parse-pendo-csv'],
    mutationFn: async (csv: string) => {
      console.log('[Pendo Cleanup] Sending CSV to server, length:', csv.length);
      const result = await apiRequest('/api/admin/pendo/parse-csv', {
        method: 'POST',
        body: JSON.stringify({ csvContent: csv })
      });
      console.log('[Pendo Cleanup] Server response:', result);
      return result;
    },
    onSuccess: (data: any) => {
      console.log('[Pendo Cleanup] Parse successful, visitor count:', data.totalVisitors);
      console.log('[Pendo Cleanup] visitorIds received:', data.visitorIds);
      console.log('[Pendo Cleanup] visitorIds type:', typeof data.visitorIds, 'isArray:', Array.isArray(data.visitorIds));
      const visitors = data.visitorIds || [];
      console.log('[Pendo Cleanup] About to setParsedVisitors with:', visitors, 'length:', visitors.length);
      setParsedVisitors(visitors);
      console.log('[Pendo Cleanup] setParsedVisitors called');
      toast({
        title: "CSV parsed",
        description: `Found ${data.totalVisitors} anonymous visitors to delete`
      });
    },
    onError: (error: any) => {
      console.error('[Pendo Cleanup] Parse error:', error);
      toast({
        title: "CSV parsing failed",
        description: error.message || "Failed to parse CSV file",
        variant: "destructive"
      });
    }
  });

  // Cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async ({ visitorIds, dryRun }: { visitorIds: string[], dryRun: boolean }): Promise<CleanupResult> => {
      return apiRequest('/api/admin/pendo/cleanup', {
        method: 'POST',
        body: JSON.stringify({ visitorIds, dryRun })
      });
    },
    onSuccess: (data: CleanupResult) => {
      setCleanupResult(data);
      if (data.dryRun) {
        toast({
          title: "Dry run complete",
          description: `Would delete ${data.totalDeleted} visitors in ${data.batches} batches`
        });
      } else {
        toast({
          title: "Cleanup complete",
          description: `Deleted ${data.totalDeleted} visitors (${data.totalFailed} failed)`
        });
        // Clear form after successful cleanup
        setCsvContent("");
        setParsedVisitors([]);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Cleanup failed",
        description: error.message || "Failed to cleanup Pendo visitors",
        variant: "destructive"
      });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('[Pendo Cleanup] No file selected');
      return;
    }

    console.log('[Pendo Cleanup] File selected:', file.name, file.size, 'bytes');

    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      console.log('[Pendo Cleanup] File read successfully, length:', text?.length);
      
      if (!text) {
        toast({
          title: "File read failed",
          description: "The CSV file appears to be empty",
          variant: "destructive"
        });
        // Reset file input
        event.target.value = '';
        return;
      }
      
      setCsvContent(text);
      console.log('[Pendo Cleanup] Triggering CSV parsing mutation...');
      parseCsvMutation.mutate(text);
      
      // Reset file input after reading
      event.target.value = '';
    };
    
    reader.onerror = (error) => {
      console.error('[Pendo Cleanup] FileReader error:', error);
      toast({
        title: "File read error",
        description: "Failed to read the CSV file. Please try again.",
        variant: "destructive"
      });
      // Reset file input
      event.target.value = '';
    };
    
    reader.readAsText(file);
  };

  const handleDryRun = () => {
    console.log('[Pendo Cleanup] handleDryRun called, parsedVisitorsCount:', parsedVisitorsCount);
    if (parsedVisitorsCount === 0) return;
    cleanupMutation.mutate({ visitorIds: parsedVisitors, dryRun: true });
  };

  const handleLiveCleanup = () => {
    console.log('[Pendo Cleanup] handleLiveCleanup called, parsedVisitorsCount:', parsedVisitorsCount);
    if (parsedVisitorsCount === 0) return;
    setShowConfirmDialog(true);
  };

  // Debug: Log button state
  console.log('[Pendo Cleanup] Render - parsedVisitorsCount:', parsedVisitorsCount, 'cleanupMutation.isPending:', cleanupMutation.isPending, 'buttons disabled:', parsedVisitorsCount === 0 || cleanupMutation.isPending);

  const confirmLiveCleanup = () => {
    cleanupMutation.mutate({ visitorIds: parsedVisitors, dryRun: false });
    setShowConfirmDialog(false);
  };

  return (
    <Card className="border-2 border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600">
          <Database className="h-5 w-5" />
          Pendo Visitor Cleanup
        </CardTitle>
        <CardDescription>
          Remove anonymous visitors from Pendo to stay under the free tier limit. Upload the visitor CSV from Pendo, preview the cleanup, then execute.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Upload Visitor CSV from Pendo
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={parseCsvMutation.isPending}
            className="block w-full text-sm text-[#263d57] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed"
            data-pendo="input-pendo-csv-upload"
          />
          {parseCsvMutation.isPending && (
            <p className="text-sm text-orange-600 mt-2">Parsing CSV file...</p>
          )}
        </div>

        {/* Parsed Results */}
        {parsedVisitorsCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-orange-900">
                Found {parsedVisitorsCount} anonymous visitors
              </span>
              <Badge variant="outline" className="bg-white">
                Ready to delete
              </Badge>
            </div>
            <div className="text-xs text-orange-700 bg-white p-2 rounded border border-orange-200 max-h-32 overflow-y-auto">
              {parsedVisitors.slice(0, 10).join(', ')}
              {parsedVisitorsCount > 10 && ` ... and ${parsedVisitorsCount - 10} more`}
            </div>
          </div>
        )}

        {/* Cleanup Result */}
        {cleanupResult && (
          <div className={`border rounded-lg p-4 ${cleanupResult.dryRun ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
            <div className="font-medium mb-2 ${cleanupResult.dryRun ? 'text-blue-900' : 'text-green-900'}">
              {cleanupResult.dryRun ? 'Dry Run Results' : 'Cleanup Results'}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Total Processed: <strong>{cleanupResult.totalProcessed}</strong></div>
              <div>Total Deleted: <strong>{cleanupResult.totalDeleted}</strong></div>
              <div>Total Failed: <strong>{cleanupResult.totalFailed}</strong></div>
              <div>Batches: <strong>{cleanupResult.batches}</strong></div>
            </div>
            {cleanupResult.errors.length > 0 && (
              <div className="mt-2 text-xs text-red-600 bg-white p-2 rounded border border-red-200">
                Errors: {cleanupResult.errors.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleDryRun}
            disabled={parsedVisitorsCount === 0 || cleanupMutation.isPending}
            variant="outline"
            className="flex-1"
            data-pendo="button-pendo-dry-run"
          >
            {cleanupMutation.isPending ? 'Processing...' : 'Dry Run (Preview)'}
          </Button>
          <Button
            onClick={handleLiveCleanup}
            disabled={parsedVisitorsCount === 0 || cleanupMutation.isPending}
            className="flex-1 bg-orange-600 hover:bg-orange-700"
            data-pendo="button-pendo-live-cleanup"
          >
            {cleanupMutation.isPending ? 'Deleting...' : 'Delete Visitors (LIVE)'}
          </Button>
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Pendo Cleanup</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to permanently delete <strong>{parsedVisitorsCount} anonymous visitors</strong> from Pendo. This action cannot be undone.
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded text-sm">
                  <strong>What will happen:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>All events for these visitors will be deleted</li>
                    <li>All metadata will be removed</li>
                    <li>Visitors will be marked as Do Not Process (DNP)</li>
                    <li>Deletion will be processed in batches of 100</li>
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-pendo="button-cancel-pendo-cleanup">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmLiveCleanup}
                className="bg-orange-600 hover:bg-orange-700"
                data-pendo="button-confirm-pendo-cleanup"
              >
                Yes, Delete {parsedVisitors.length} Visitors
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}