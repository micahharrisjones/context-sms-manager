import { LoginScreen } from "@/components/auth/LoginScreen";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const { needsProfileSetup } = useProfile();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      if (needsProfileSetup) {
        setLocation("/setup");
      } else {
        setLocation("/");
      }
    }
  }, [isAuthenticated, needsProfileSetup, setLocation]);

  return <LoginScreen onLogin={login} />;
}
