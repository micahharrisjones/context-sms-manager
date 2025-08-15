import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SearchPage from "@/pages/search";
import { Layout } from "@/components/layout/Layout";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tag/:tag" component={Home} />
        <Route path="/shared/:boardName" component={Home} />
        <Route path="/search" component={SearchPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#efe1dc]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 animate-spin">
            <img 
              src="/attached_assets/context-avatar_1755280181791.png" 
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
