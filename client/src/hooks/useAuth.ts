import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { pendo } from '@/lib/pendo';

interface User {
  id: number;
  phoneNumber: string;
  displayName: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const response = await apiRequest('/api/auth/session');
      const data = await response.json();
      
      if (data.authenticated) {
        // Get user details if authenticated
        try {
          const profileResponse = await apiRequest('/api/profile');
          if (profileResponse.ok) {
            const user = await profileResponse.json();
            
            // Initialize Pendo with user data (async)
            try {
              await pendo.initialize(user);
              console.log('Pendo initialized during session check for user:', user.id);
            } catch (pendoError) {
              console.warn('Pendo initialization failed during session check:', pendoError);
            }
            
            setAuthState({
              user,
              isLoading: false,
              isAuthenticated: true,
            });
          } else {
            setAuthState({
              user: null,
              isLoading: false,
              isAuthenticated: true,
            });
          }
        } catch (profileError) {
          console.error('Failed to fetch profile:', profileError);
          setAuthState({
            user: null,
            isLoading: false,
            isAuthenticated: true,
          });
        }
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const login = async (user: User) => {
    // Reset scroll position and viewport for mobile after login
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      
      // Force a reflow to ensure proper viewport calculation on mobile
      document.body.style.minHeight = '100vh';
      document.body.style.minHeight = '100dvh';
    }, 50);
    
    // Initialize Pendo with user data (async)
    try {
      await pendo.initialize(user);
      console.log('Pendo initialized during login for user:', user.id);
    } catch (pendoError) {
      console.warn('Pendo initialization failed during login:', pendoError);
    }
    
    setAuthState({
      user,
      isLoading: false,
      isAuthenticated: true,
    });
  };

  const logout = async () => {
    try {
      console.log('Attempting logout...');
      
      // Clear Pendo visitor data first
      try {
        await pendo.clearVisitor();
        console.log('Pendo visitor cleared during logout');
      } catch (pendoError) {
        console.warn('Pendo visitor clear failed during logout:', pendoError);
      }
      
      // Then call logout API
      await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Reset Pendo session completely
      try {
        pendo.reset();
        console.log('Pendo session reset during logout');
      } catch (pendoError) {
        console.warn('Pendo reset failed during logout:', pendoError);
      }
      
      // Clear auth state regardless of API call success
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      console.log('Auth state cleared - redirecting to login');
      
      // Force a page refresh to ensure clean state
      window.location.reload();
    }
  };

  return {
    ...authState,
    login,
    logout,
    checkSession,
  };
}