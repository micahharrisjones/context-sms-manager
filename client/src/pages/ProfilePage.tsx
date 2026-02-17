import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { apiRequest } from '@/lib/queryClient';
import { InviteFriendsModal } from '@/components/invite/InviteFriendsModal';
import { DeleteAccountModal } from '@/components/layout/DeleteAccountModal';
import {
  Save,
  UserPlus,
  MessageSquare,
  Bell,
  Settings,
  Trash2,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { pendo } from '@/lib/pendo';
import { useEffect } from 'react';

const profileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  avatarUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;

export function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const { profile, isLoading, getDisplayName, getInitials } = useProfile();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: adminStats } = useQuery({
    queryKey: ['/api/admin/stats'],
    retry: false,
    enabled: !!profile,
  });

  const form = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      avatarUrl: profile?.avatarUrl || '',
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        avatarUrl: profile.avatarUrl || '',
      });
    }
  }, [profile, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateData) => {
      const profileData = {
        firstName: data.firstName,
        lastName: data.lastName,
        ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
      };

      return apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });

      if (profile) {
        const updatedProfile = {
          ...profile,
          firstName: variables.firstName,
          lastName: variables.lastName,
          displayName: `${variables.firstName} ${variables.lastName}`,
          ...(variables.avatarUrl && { avatarUrl: variables.avatarUrl }),
        };

        pendo.identifyUser(updatedProfile)
          .then(() => console.log('Pendo profile updated in real-time'))
          .catch((error) => console.warn('Failed to update Pendo profile:', error));
      }
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileUpdateData) => {
    updateProfileMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf6f3] px-4 py-8">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="animate-pulse flex flex-col items-center gap-3">
            <div className="h-20 w-20 bg-[#263d57]/10 rounded-full" />
            <div className="h-6 w-40 bg-[#263d57]/10 rounded" />
            <div className="h-4 w-32 bg-[#263d57]/10 rounded" />
          </div>
          <div className="h-64 bg-[#263d57]/10 rounded-xl" />
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      icon: UserPlus,
      label: 'Invite Friends',
      pendo: 'profile-invite-friends',
      onClick: () => setInviteModalOpen(true),
    },
    {
      icon: MessageSquare,
      label: 'Feedback',
      pendo: 'profile-feedback',
      onClick: () => setLocation('/feedback'),
    },
    {
      icon: Bell,
      label: 'Notification Settings',
      pendo: 'profile-notification-settings',
      onClick: () => setLocation('/notifications'),
    },
    ...(adminStats
      ? [
          {
            icon: Settings,
            label: 'Admin Panel',
            pendo: 'profile-admin-panel',
            onClick: () => setLocation('/admin'),
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#faf6f3] px-4 py-8 pb-28">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center gap-2 py-4" data-pendo="profile-header">
          <Avatar className="h-24 w-24 shadow-md">
            <AvatarImage src={profile?.avatarUrl} alt={getDisplayName()} />
            <AvatarFallback className="bg-[#b95827] text-white text-2xl font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold text-[#263d57] mt-2">{getDisplayName()}</h1>
          <p className="text-sm text-[#263d57]/60">{profile?.phoneNumber}</p>
        </div>

        {/* Edit Profile Section */}
        <Card className="bg-white border-0 shadow-sm rounded-xl" data-pendo="profile-edit-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[#263d57]">Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-[#263d57]/80 text-sm">First Name</Label>
                  <Input
                    id="firstName"
                    {...form.register('firstName')}
                    placeholder="First name"
                    className="border-[#e3cac0] focus:border-[#b95827] bg-[#faf6f3]/50"
                    data-pendo="input-profile-first-name"
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-xs text-red-600">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-[#263d57]/80 text-sm">Last Name</Label>
                  <Input
                    id="lastName"
                    {...form.register('lastName')}
                    placeholder="Last name"
                    className="border-[#e3cac0] focus:border-[#b95827] bg-[#faf6f3]/50"
                    data-pendo="input-profile-last-name"
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-xs text-red-600">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="avatarUrl" className="text-[#263d57]/80 text-sm">Profile Picture URL</Label>
                <Input
                  id="avatarUrl"
                  {...form.register('avatarUrl')}
                  placeholder="https://example.com/photo.jpg"
                  className="border-[#e3cac0] focus:border-[#b95827] bg-[#faf6f3]/50"
                  data-pendo="input-profile-avatar-url"
                />
                {form.formState.errors.avatarUrl && (
                  <p className="text-xs text-red-600">{form.formState.errors.avatarUrl.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#b95827] hover:bg-[#a04d1f] text-white"
                disabled={updateProfileMutation.isPending}
                data-pendo="button-save-profile"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Actions Section */}
        <Card className="bg-white border-0 shadow-sm rounded-xl overflow-hidden" data-pendo="profile-quick-actions">
          <CardContent className="p-0">
            {quickActions.map((action, idx) => (
              <button
                key={action.pendo}
                onClick={action.onClick}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#faf6f3]/60 transition-colors ${
                  idx < quickActions.length - 1 ? 'border-b border-[#e3cac0]/40' : ''
                }`}
                data-pendo={action.pendo}
              >
                <action.icon className="h-5 w-5 text-[#b95827] flex-shrink-0" />
                <span className="flex-1 text-[#263d57] text-sm font-medium">{action.label}</span>
                <ChevronRight className="h-4 w-4 text-[#263d57]/30 flex-shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Account Section */}
        <Card className="bg-white border-0 shadow-sm rounded-xl overflow-hidden" data-pendo="profile-account-section">
          <CardContent className="p-0">
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-red-50 transition-colors border-b border-[#e3cac0]/40"
              data-pendo="profile-delete-account"
            >
              <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span className="flex-1 text-red-600 text-sm font-medium">Delete Account</span>
              <ChevronRight className="h-4 w-4 text-red-300 flex-shrink-0" />
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#faf6f3]/60 transition-colors"
              data-pendo="profile-logout"
            >
              <LogOut className="h-5 w-5 text-[#263d57]/50 flex-shrink-0" />
              <span className="flex-1 text-[#263d57]/70 text-sm font-medium">Log Out</span>
              <ChevronRight className="h-4 w-4 text-[#263d57]/30 flex-shrink-0" />
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <InviteFriendsModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        userDisplayName={getDisplayName()}
      />
      <DeleteAccountModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}