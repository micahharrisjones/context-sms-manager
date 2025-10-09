import { Redirect } from "wouter";
import { ProfileSetup } from "@/components/auth/ProfileSetup";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

export default function SetupPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { needsProfileSetup, isLoading: profileLoading } = useProfile();

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-[#fff2ea]" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 animate-pulse">
            <img 
              src="/aside-logo-loader.png" 
              alt="Aside Logo" 
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
          <p className="text-[#263d57]/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (!needsProfileSetup) {
    return <Redirect to="/" />;
  }

  return <ProfileSetup onComplete={() => window.location.reload()} />;
}
