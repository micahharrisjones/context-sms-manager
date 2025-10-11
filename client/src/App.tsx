import { Switch, Route, Redirect, useLocation } from "wouter";
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

  if (needsProfileSetup) {
    return <Redirect to="/setup" />;
  }

  return <Component />;
}

function Router() {
  const [location] = useLocation();

  // Track SPA page loads for Pendo
  useEffect(() => {
    pendo.pageLoad(window.location.href);
  }, [location]);

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
          <Route path="/tag/private/:tag">
            {() => <ProtectedRoute component={AllTexts} />}
          </Route>
          <Route path="/tag/shared/:boardName">
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
  // Initialize Pendo anonymously on app startup
  useEffect(() => {
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
