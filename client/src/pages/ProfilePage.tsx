import React from 'react';
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
import { apiRequest } from '@/lib/queryClient';
import { User, Save } from 'lucide-react';
import { useLocation } from 'wouter';

const profileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  avatarUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;

interface UserProfile {
  id: number;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  displayName?: string;
}

export function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/profile'],
  });

  const form = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      avatarUrl: profile?.avatarUrl || '',
    }
  });

  // Update form when profile data loads
  React.useEffect(() => {
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
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      // Redirect to main board after successful save
      setLocation('/');
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
    }
    return profile?.displayName?.[0]?.toUpperCase() || 'U';
  };

  const getDisplayName = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    return profile?.displayName || 'User';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-white border-[#e3cac0]">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatarUrl} alt={getDisplayName()} />
                <AvatarFallback className="bg-[#b95827] text-white text-lg">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-2xl">Edit Profile</CardTitle>
            <p className="text-gray-600">
              Phone: {profile?.phoneNumber}
            </p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    {...form.register('firstName')}
                    placeholder="Enter your first name"
                    className="border-[#e3cac0] focus:border-[#b95827]"
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.firstName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    {...form.register('lastName')}
                    placeholder="Enter your last name"
                    className="border-[#e3cac0] focus:border-[#b95827]"
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Profile Picture URL</Label>
                <Input
                  id="avatarUrl"
                  {...form.register('avatarUrl')}
                  placeholder="https://example.com/your-photo.jpg"
                  className="border-[#e3cac0] focus:border-[#ed2024]"
                />
                {form.formState.errors.avatarUrl && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.avatarUrl.message}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  You can use a photo from social media or any image hosting service
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#b95827] hover:bg-[#a04d1f] text-white"
                disabled={updateProfileMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}