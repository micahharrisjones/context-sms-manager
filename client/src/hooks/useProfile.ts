import { useQuery } from '@tanstack/react-query';

interface UserProfile {
  id: number;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  displayName?: string;
}

export function useProfile() {
  const { data: profile, isLoading, error } = useQuery<UserProfile>({
    queryKey: ['/api/profile'],
    retry: false,
  });

  const needsProfileSetup = profile && (!profile.firstName || !profile.lastName);
  
  const getDisplayName = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    return profile?.displayName || 'User';
  };

  const getInitials = () => {
    if (profile?.firstName && profile?.lastName) {
      return `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
    }
    return profile?.displayName?.[0]?.toUpperCase() || 'U';
  };

  return {
    profile,
    isLoading,
    error,
    needsProfileSetup,
    getDisplayName,
    getInitials,
  };
}