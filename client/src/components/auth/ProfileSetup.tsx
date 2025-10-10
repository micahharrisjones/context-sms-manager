import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { User } from 'lucide-react';

const profileSetupSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  avatarUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

type ProfileSetupData = z.infer<typeof profileSetupSchema>;

interface ProfileSetupProps {
  onComplete: () => void;
}

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ProfileSetupData>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      avatarUrl: '',
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileSetupData) => {
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
        title: "Profile Created!",
        description: "Your profile has been set up successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      onComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to create profile",
        variant: "destructive",
      });
    },
  });

  const skipSetupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: 'User',
          lastName: 'User',
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      onComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to skip setup",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileSetupData) => {
    updateProfileMutation.mutate(data);
  };

  const handleSkip = () => {
    skipSetupMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[#fff2ea] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white border-[#e3cac0]">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-[#b95827] rounded-full flex items-center justify-center">
            <User className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Set Up Your Profile</CardTitle>
          <CardDescription>
            Add your name to make it easier for others to find you in shared boards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                {...form.register('firstName')}
                placeholder="Enter your first name"
                className="border-[#e3cac0] focus:border-[#b95827]"
                data-pendo="input-setup-first-name"
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
                data-pendo="input-setup-last-name"
              />
              {form.formState.errors.lastName && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Profile Picture URL (Optional)</Label>
              <Input
                id="avatarUrl"
                {...form.register('avatarUrl')}
                placeholder="https://example.com/your-photo.jpg"
                className="border-[#e3cac0] focus:border-[#b95827]"
                data-pendo="input-setup-avatar-url"
              />
              {form.formState.errors.avatarUrl && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.avatarUrl.message}
                </p>
              )}
              <p className="text-xs text-[#263d57]/70">
                You can use a photo from social media or any image hosting service
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-[#e3cac0] hover:bg-[#fff2ea]"
                onClick={handleSkip}
                disabled={skipSetupMutation.isPending}
                data-pendo="button-skip-profile-setup"
              >
                {skipSetupMutation.isPending ? "Skipping..." : "Skip for Now"}
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#b95827] hover:bg-[#a04d1f] text-white"
                disabled={updateProfileMutation.isPending}
                data-pendo="button-complete-profile-setup"
              >
                {updateProfileMutation.isPending ? "Setting up..." : "Complete Setup"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}