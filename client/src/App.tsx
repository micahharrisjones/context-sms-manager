import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SearchPage from "@/pages/search";
import { AdminPage } from "@/pages/AdminPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { NotificationSettingsPage } from "@/pages/NotificationSettingsPage";
import { Layout } from "@/components/layout/Layout";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { ProfileSetup } from "@/components/auth/ProfileSetup";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tag/:tag" component={Home} />
        <Route path="/shared/:boardName" component={Home} />
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
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-[#fff3ea]" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 animate-spin">
            <img 
              src="/context-logo.png" 
              alt="Context Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-gray-600">Loading Context...</p>
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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedApp />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
