import { ProfileSetup } from "@/components/auth/ProfileSetup";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function SetupPage() {
  const { isAuthenticated } = useAuth();
  const { needsProfileSetup } = useProfile();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (!needsProfileSetup) {
      setLocation("/");
    }
  }, [isAuthenticated, needsProfileSetup, setLocation]);

  return <ProfileSetup onComplete={() => setLocation("/")} />;
}
