import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Logo } from '@/components/layout/Logo';
import { MessageSquare } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: any) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Ensure we're scrolled to top on mobile when login screen loads
  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Logging in with phone number:', phoneNumber);
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Login response:', data);
        // Removed login success toast for cleaner UX
        onLogin(data.user);
      } else {
        const error = await response.json();
        console.error('API error response:', error);
        toast({
          title: "Error",
          description: error.error || "Failed to log in",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Error", 
        description: `Network error: ${error instanceof Error ? error.message : 'Please try again.'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-[#fff3ea] px-4 py-8 safe-area-inset" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
      <Card className="w-full max-w-md my-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            <Logo className="w-auto h-16" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#ed2024] leading-tight">
              Text it, tag it, find it later.
            </h1>
            <p className="text-gray-600 text-sm leading-tight">
              Save anything from anywhere, with just a text.
            </p>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="234 555 6789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={isLoading}
                className="text-lg"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-[#ed2024] hover:bg-[#d61e21]"
              disabled={isLoading || !phoneNumber.trim()}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
        
        {/* SMS Signup Information */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 m-4">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
            <MessageSquare className="h-4 w-4 mr-2" />
            New to Context? Sign up via SMS!
          </h3>
          <p className="text-sm text-blue-700 mb-2">
            Just send a text with a hashtag and we'll set up your personal Context account immediately.
          </p>
          <div className="bg-white p-3 rounded border border-blue-200 text-center">
            <p className="text-xs text-gray-600 mb-1">Text your messages to:</p>
            <a 
              href="sms:+14582188508" 
              className="font-mono text-lg font-bold text-blue-900 hover:text-blue-700 hover:underline cursor-pointer block"
            >
              +1 458-218-8508
            </a>
            <p className="text-xs text-gray-500 mt-1">Tap the number to start texting</p>
          </div>
          <div className="mt-3 text-xs text-blue-600">
            <p className="mb-1"><strong>Example:</strong> "Check out this movie #movies https://imdb.com/..."</p>
            <p>Then log in here with your phone number to see your saved texts organized into separate boards.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}