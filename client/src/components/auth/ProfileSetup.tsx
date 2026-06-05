import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
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
  lastName: z.string().max(50).optional().or(z.literal('')),
});

type ProfileSetupData = z.infer<typeof profileSetupSchema>;

interface ProfileSetupProps {
  onComplete: () => void;
}

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const form = useForm<ProfileSetupData>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileSetupData) => {
      return apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName || '',
        }),
      });
    },
    onSuccess: async () => {
      toast({
        title: "Profile Created!",
        description: "Your profile has been set up successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      
      // Check if there's a pending board to redirect to
      const pendingBoardId = localStorage.getItem('pendingBoardId');
      const pendingBoardName = localStorage.getItem('pendingBoardName');
      
      if (pendingBoardId && pendingBoardName) {
        // Clear the pending board data
        localStorage.removeItem('pendingBoardId');
        localStorage.removeItem('pendingBoardName');
        
        try {
          // Verify board still exists before redirecting
          const res = await fetch(`/api/shared-boards/${pendingBoardId}/preview`);
          if (res.ok) {
            // Use router navigation instead of window.location
            setLocation(`/tag/shared/${pendingBoardName}`);
          } else {
            // Board doesn't exist anymore, go to dashboard
            toast({
              title: "Board Not Found",
              description: "The board you were invited to no longer exists.",
              variant: "destructive",
            });
            onComplete();
          }
        } catch (error) {
          // If verification fails, just go to dashboard
          onComplete();
        }
      } else {
        onComplete();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to create profile",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileSetupData) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-[#faf6f3] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white border-[#e3cac0]">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-[#b95827] rounded-full flex items-center justify-center">
            <User className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">What's your name?</CardTitle>
          <CardDescription>
            Your name will appear on comments in shared boards. A nickname is totally fine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                {...form.register('firstName')}
                placeholder="First name or nickname"
                className="border-[#e3cac0] focus:border-[#b95827]"
                data-pendo="input-setup-first-name"
                autoFocus
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name <span className="text-[#263d57]/40 text-xs font-normal">(optional)</span></Label>
              <Input
                id="lastName"
                {...form.register('lastName')}
                placeholder="Last name"
                className="border-[#e3cac0] focus:border-[#b95827]"
                data-pendo="input-setup-last-name"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#b95827] hover:bg-[#a04d1f] text-white mt-2"
              disabled={updateProfileMutation.isPending}
              data-pendo="button-complete-profile-setup"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}