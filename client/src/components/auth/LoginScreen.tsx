import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Logo } from '@/components/layout/Logo';
import { MessageSquare } from 'lucide-react';
import { pendo } from '@/lib/pendo';

interface LoginScreenProps {
  onLogin: (user: any) => Promise<void>;
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

    // Track login attempt
    await pendo.track('Login Attempt', {
      login_method: 'sms_verification',
      platform: 'web',
      phone_number_provided: !!phoneNumber.trim()
    });

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
          // Track verification code sent
          await pendo.track('Verification Code Sent', {
            login_method: 'sms_verification',
            platform: 'web',
            phone_number: phoneNumber
          });
          
          setShowVerification(true);
          toast({
            title: "Verification code sent",
            description: "Please check your phone for the verification code",
          });
        } else {
          // Fallback for existing users without verification
          await onLogin(data.user);
          
          // Track successful login (after onLogin completes)
          await pendo.track('User Login Success', {
            login_method: 'legacy_fallback',
            platform: 'web',
            user_id: data.user.id.toString()
          });
        }
      } else {
        const error = await response.json();
        console.error('API error response:', error);
        
        // Track login failure
        await pendo.track('Login Failed', {
          login_method: 'sms_verification',
          platform: 'web',
          error_type: 'api_error',
          error_message: error.error || 'Failed to send verification code'
        });
        
        toast({
          title: "Error",
          description: error.error || "Failed to send verification code",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Track network error
      await pendo.track('Login Failed', {
        login_method: 'sms_verification',
        platform: 'web',
        error_type: 'network_error',
        error_message: error instanceof Error ? error.message : 'Network error'
      });
      
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

    // Track verification attempt
    await pendo.track('Verification Attempt', {
      login_method: 'sms_verification',
      platform: 'web',
      phone_number: phoneNumber,
      code_length: verificationCode.length
    });

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
          // Call onLogin first (this initializes Pendo)
          await onLogin(data.user);
          
          // Track successful login AFTER onLogin completes (and Pendo is initialized)
          await pendo.track('User Login Success', {
            login_method: 'sms_verification',
            platform: 'web',
            user_id: data.user.id.toString(),
            verification_completed: true
          });
        } else {
          // Track verification failure
          await pendo.track('Verification Failed', {
            login_method: 'sms_verification',
            platform: 'web',
            phone_number: phoneNumber,
            error_type: 'verification_failed',
            error_message: data.message || 'Verification failed'
          });
          
          toast({
            title: "Error",
            description: data.message || "Verification failed",
            variant: "destructive",
          });
        }
      } else {
        const error = await response.json();
        console.error('Verification error response:', error);
        
        // Track verification API error
        await pendo.track('Verification Failed', {
          login_method: 'sms_verification',
          platform: 'web',
          phone_number: phoneNumber,
          error_type: 'api_error',
          error_message: error.message || 'Invalid verification code'
        });
        
        toast({
          title: "Error",
          description: error.message || "Invalid verification code",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      
      // Track verification network error
      await pendo.track('Verification Failed', {
        login_method: 'sms_verification',
        platform: 'web',
        phone_number: phoneNumber,
        error_type: 'network_error',
        error_message: error instanceof Error ? error.message : 'Network error'
      });
      
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
          <div className="mx-auto mb-4">
            <img 
              src="/aside-logo-login.png" 
              alt="Aside" 
              className="w-48 mx-auto"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#263d57] leading-tight">
              Text it, tag it, find it later.
            </h1>
            <p className="text-[#263d57]/70 text-sm leading-tight">
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
                  data-pendo="input-phone-number"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-[#b95827] hover:bg-[#a04d1f]"
                disabled={isLoading || !phoneNumber.trim()}
                data-pendo="button-send-verification-code"
              >
                {isLoading ? "Sending code..." : "Send verification code"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <MessageSquare className="h-8 w-8 mx-auto text-[#b95827]" />
                <h3 className="font-semibold text-[#263d57]">Check your phone</h3>
                <p className="text-sm text-[#263d57]/70">
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
                    data-pendo="input-verification-code"
                  />
                </div>
                
                <div className="space-y-2">
                  <Button 
                    type="submit" 
                    className="w-full bg-[#b95827] hover:bg-[#a04d1f]"
                    disabled={isLoading || verificationCode.length !== 6}
                    data-pendo="button-verify-and-login"
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
                    data-pendo="button-back-to-phone"
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