import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AllTexts from "@/pages/all-texts";
import SearchPage from "@/pages/search";
import { AdminPage } from "@/pages/AdminPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { NotificationSettingsPage } from "@/pages/NotificationSettingsPage";
import { Layout } from "@/components/layout/Layout";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { ProfileSetup } from "@/components/auth/ProfileSetup";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { pendo } from "@/lib/pendo";

function Router() {
  const [location] = useLocation();

  // Track SPA page loads for Pendo
  useEffect(() => {
    // Track initial page load and route changes
    pendo.pageLoad(window.location.href);
  }, [location]); // Re-run when location changes

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/all-texts" component={AllTexts} />
        <Route path="/tag/:tag" component={AllTexts} />
        <Route path="/shared/:boardName" component={AllTexts} />
        <Route path="/search" component={SearchPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/notifications" component={NotificationSettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const { needsProfileSetup, isLoading: profileLoading } = useProfile();

  if (isLoading || profileLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-[#fff2ea]" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 animate-spin">
            <img 
              src="/aside-logo-loader.png" 
              alt="Aside Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-[#263d57]/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} />;
  }

  if (needsProfileSetup) {
    return <ProfileSetup onComplete={() => window.location.reload()} />;
  }

  return <Router />;
}

function App() {
  // Initialize Pendo anonymously on app startup to fix connection verification
  useEffect(() => {
    // Initialize Pendo immediately with anonymous visitor
    // This creates a session even before authentication
    pendo.initialize().catch((error) => {
      console.warn('Failed to initialize Pendo anonymously:', error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedApp />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
