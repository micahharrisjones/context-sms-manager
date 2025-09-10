import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Logo } from '@/components/layout/Logo';
import { MessageSquare } from 'lucide-react';
import analytics from '@/lib/mixpanel';

interface LoginScreenProps {
  onLogin: (user: any) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
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
      console.log('Requesting verification code for phone number:', phoneNumber);
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Login response:', data);
        
        if (data.requiresVerification) {
          setShowVerification(true);
          toast({
            title: "Verification code sent",
            description: "Please check your phone for the verification code",
          });
        } else {
          // Fallback for existing users without verification
          onLogin(data.user);
        }
      } else {
        const error = await response.json();
        console.error('API error response:', error);
        toast({
          title: "Error",
          description: error.error || "Failed to send verification code",
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

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Verifying code for phone number:', phoneNumber);
      const response = await apiRequest('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, code: verificationCode }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Verification response:', data);
        
        if (data.success) {
          // Track login success and identify user
          analytics.identify(data.user.id.toString());
          analytics.setUserProperties({
            phone_number: data.user.phoneNumber, // Will be hashed by setUserProperties
            display_name: data.user.displayName,
            signup_source: 'sms' // Default assumption, backend will have more precise data
          });
          analytics.track('User Login Success', {
            user_id: data.user.id.toString(),
            login_method: 'sms_verification',
            platform: 'web'
          });
          
          toast({
            title: "Login successful",
            description: "Welcome to Context!",
          });
          onLogin(data.user);
        } else {
          toast({
            title: "Error",
            description: data.message || "Verification failed",
            variant: "destructive",
          });
        }
      } else {
        const error = await response.json();
        console.error('Verification error response:', error);
        toast({
          title: "Error",
          description: error.message || "Invalid verification code",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
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
            <img 
              src="/context-avatar.png" 
              alt="Context" 
              className="w-16 h-16 mx-auto"
            />
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
          {!showVerification ? (
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
                {isLoading ? "Sending code..." : "Send verification code"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <MessageSquare className="h-8 w-8 mx-auto text-[#ed2024]" />
                <h3 className="font-semibold text-gray-900">Check your phone</h3>
                <p className="text-sm text-gray-600">
                  We sent a verification code to<br />
                  <span className="font-medium">{phoneNumber}</span>
                </p>
              </div>
              
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    disabled={isLoading}
                    className="text-lg text-center tracking-widest"
                    maxLength={6}
                  />
                </div>
                
                <div className="space-y-2">
                  <Button 
                    type="submit" 
                    className="w-full bg-[#ed2024] hover:bg-[#d61e21]"
                    disabled={isLoading || verificationCode.length !== 6}
                  >
                    {isLoading ? "Verifying..." : "Verify and login"}
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="ghost"
                    className="w-full text-sm"
                    onClick={() => {
                      setShowVerification(false);
                      setVerificationCode('');
                    }}
                    disabled={isLoading}
                  >
                    ← Back to phone number
                  </Button>
                </div>
              </form>
            </div>
          )}
        </CardContent>
        
      </Card>
    </div>
  );
}