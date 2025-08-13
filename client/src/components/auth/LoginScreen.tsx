import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Logo } from '@/components/layout/Logo';

interface LoginScreenProps {
  onLogin: (user: any) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Sending verification request for:', phoneNumber);
      const response = await apiRequest('/api/auth/request-code', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Verification response:', data);
        toast({
          title: "Verification code sent",
          description: `Enter the 6-digit code: ${data.code}`, // Remove this in production
        });
        setStep('code');
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
      console.error('Request code error:', error);
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
      console.log('Verifying code:', verificationCode, 'for phone:', phoneNumber);
      const response = await apiRequest('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, code: verificationCode }),
      });

      const data = await response.json();
      console.log('Verify response:', data);

      if (response.ok && data.success) {
        toast({
          title: "Welcome to Context!",
          description: "You've been successfully authenticated.",
        });
        onLogin(data.user);
      } else {
        toast({
          title: "Authentication failed",
          description: data.message || "Invalid verification code",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Verify code error:', error);
      toast({
        title: "Error",
        description: `Network error: ${error instanceof Error ? error.message : 'Please try again.'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep('phone');
    setPhoneNumber('');
    setVerificationCode('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6">
            <Logo className="w-auto h-16" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Welcome to Context
          </CardTitle>
          <CardDescription>
            {step === 'phone' 
              ? "Enter your phone number to get started" 
              : "Enter the verification code sent to your phone"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {step === 'phone' ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
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
                {isLoading ? "Sending..." : "Send Verification Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  disabled={isLoading}
                  className="text-lg text-center tracking-widest"
                  maxLength={6}
                />
              </div>
              <div className="text-sm text-gray-600 text-center">
                Code sent to {phoneNumber}
              </div>
              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full bg-[#ed2024] hover:bg-[#d61e21]"
                  disabled={isLoading || verificationCode.length !== 6}
                >
                  {isLoading ? "Verifying..." : "Verify & Login"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  className="w-full"
                  onClick={resetForm}
                  disabled={isLoading}
                >
                  Use Different Number
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}