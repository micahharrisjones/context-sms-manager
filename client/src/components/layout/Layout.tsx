import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Logo } from "./Logo";
import { Link, useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();
  const params = useParams();
  const [location] = useLocation();

  // Ensure proper mobile viewport after layout loads
  useEffect(() => {
    // Force scroll to top on layout mount
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    
    // Reset any iOS Safari viewport issues
    const resetViewport = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    resetViewport();
    window.addEventListener('resize', resetViewport);
    window.addEventListener('orientationchange', resetViewport);
    
    return () => {
      window.removeEventListener('resize', resetViewport);
      window.removeEventListener('orientationchange', resetViewport);
    };
  }, []);

  // Get current board name from URL params
  const getBoardName = () => {
    const tag = params.tag;
    const boardName = params.boardName;
    
    if (boardName) return boardName;
    if (tag) return tag;
    
    // Check for specific routes
    if (location === '/all-texts') return 'All Texts';
    if (location === '/search') return 'Search';
    if (location === '/admin') return 'Admin';
    if (location === '/profile') return 'Profile';
    if (location === '/notifications') return 'Notifications';
    
    return null;
  };

  const currentBoardName = getBoardName();

  return (
    <div className="flex min-h-screen min-h-[100dvh] relative bg-[#fff2ea]" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* Sidebar with mobile overlay */}
      <div className={`
        fixed inset-0 lg:relative lg:h-screen
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-200 ease-in-out
        lg:w-64 z-40 lg:flex-shrink-0 lg:overflow-hidden
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile sticky header with hamburger and board name */}
        <div className="lg:hidden sticky top-0 z-50 bg-[#fff2ea]/95 backdrop-blur supports-[backdrop-filter]:bg-[#fff2ea]/60 border-b border-[#e3cac0]">
          <div className="p-4 flex items-center justify-between gap-3">
            {/* Hamburger button - only show when sidebar is closed */}
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="flex-shrink-0"
                data-testid="button-open-menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            )}
            
            {/* Board name or logo */}
            {currentBoardName ? (
              <h1 className="flex-1 text-lg font-semibold text-[#263d57] truncate text-center" data-testid="text-board-name">
                #{currentBoardName}
              </h1>
            ) : (
              <Link href="/" className="flex-1 flex justify-center">
                <Logo className="w-auto h-8" />
              </Link>
            )}
            
            {/* Spacer to balance the layout when hamburger is shown */}
            {!sidebarOpen && (
              <div className="w-10 flex-shrink-0" />
            )}
          </div>
        </div>
        
        {/* Content area */}
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[#263d57]/20 lg:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
