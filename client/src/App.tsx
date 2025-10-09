import { Switch, Route, useLocation, Redirect } from "wouter";
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
import LoginPage from "@/pages/login";
import SetupPage from "@/pages/setup";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { pendo } from "@/lib/pendo";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { needsProfileSetup, isLoading: profileLoading } = useProfile();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && !profileLoading) {
      if (!isAuthenticated) {
        setLocation("/login");
      } else if (needsProfileSetup) {
        setLocation("/setup");
      }
    }
  }, [isAuthenticated, needsProfileSetup, authLoading, profileLoading, setLocation]);

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

  if (!isAuthenticated || needsProfileSetup) {
    return null;
  }

  return <Component />;
}

function Router() {
  const [location] = useLocation();

  // Track SPA page loads for Pendo
  useEffect(() => {
    // Track initial page load and route changes
    pendo.pageLoad(window.location.href);
  }, [location]); // Re-run when location changes

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/setup" component={SetupPage} />
      
      {/* Protected routes */}
      <Layout>
        <Switch>
          <Route path="/">
            {() => <ProtectedRoute component={Home} />}
          </Route>
          <Route path="/all-texts">
            {() => <ProtectedRoute component={AllTexts} />}
          </Route>
          <Route path="/tag/:tag">
            {() => <ProtectedRoute component={AllTexts} />}
          </Route>
          <Route path="/shared/:boardName">
            {() => <ProtectedRoute component={AllTexts} />}
          </Route>
          <Route path="/search">
            {() => <ProtectedRoute component={SearchPage} />}
          </Route>
          <Route path="/admin">
            {() => <ProtectedRoute component={AdminPage} />}
          </Route>
          <Route path="/profile">
            {() => <ProtectedRoute component={ProfilePage} />}
          </Route>
          <Route path="/notifications">
            {() => <ProtectedRoute component={NotificationSettingsPage} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </Switch>
  );
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
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
