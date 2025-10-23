import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";
import { pendo } from "@/lib/pendo";

export default function JoinPage() {
  const [, params] = useRoute("/join/:code");
  const inviteCode = params?.code || "";
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  // Track landing page view
  useEffect(() => {
    if (inviteCode) {
      pendo.track('Invite Landing Viewed', {
        inviteCode,
        source: 'invite_link'
      });
    }
  }, [inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiRequest("/api/invite/submit", {
        method: "POST",
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          inviteCode
        })
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        
        // Track phone number submission
        pendo.track('Invite Phone Submitted', {
          inviteCode,
          phoneNumber: phoneNumber.trim()
        });
        
        toast({
          title: "Success!",
          description: data.message || "Check your phone for a confirmation text",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send SMS. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fff2ea] flex items-center justify-center px-4" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-[#263d57]">
              Check your phone!
            </h1>
            <p className="text-[#263d57]/70">
              We sent you a text. Reply <strong>YES</strong> to confirm and start using Aside.
            </p>
          </div>

          <div className="mt-8 p-4 bg-white rounded-lg border border-[#e3cac0]">
            <p className="text-sm text-[#263d57]/60">
              Didn't receive the text? Check your phone number and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fff2ea] flex items-center justify-center px-4" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img 
            src="/aside-logo-login.png" 
            alt="Aside Logo" 
            className="w-32 h-auto mx-auto mb-6 drop-shadow-md"
          />
          <h1 className="text-3xl font-bold text-[#263d57] mb-3">
            Welcome to Aside
          </h1>
          <p className="text-[#263d57]/70 text-lg">
            Save links and ideas by texting. Super simple - no app needed.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-[#e3cac0] p-8 space-y-6">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-[#263d57]">
              How it works
            </h2>
            <ul className="space-y-2 text-[#263d57]/70">
              <li className="flex items-start gap-2">
                <span className="text-[#b95827] mt-0.5">•</span>
                <span>Text anything to save it automatically</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#b95827] mt-0.5">•</span>
                <span>Use #hashtags to organize messages</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#b95827] mt-0.5">•</span>
                <span>Access your dashboard at textaside.app</span>
              </li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-[#263d57] mb-2">
                Enter your phone number
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isSubmitting}
                className="text-lg"
                data-testid="input-phone-number"
                data-pendo="input-phone-signup"
              />
              <p className="text-xs text-[#263d57]/50 mt-2">
                We'll send you a text to confirm
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#b95827] hover:bg-[#a04820] text-white text-lg py-6"
              disabled={isSubmitting}
              data-testid="button-submit-phone"
              data-pendo="button-get-started-signup"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                "Get Started"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-[#263d57]/50">
          By continuing, you agree to receive SMS messages. Reply STOP to opt out.
        </p>
      </div>
    </div>
  );
}
