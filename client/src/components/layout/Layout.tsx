import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Button } from "@/components/ui/button";
import { Menu, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { AddButton } from "./AddButton";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen relative">
      {/* Mobile menu button - hidden when sidebar is open */}
      {!sidebarOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden fixed top-4 left-4 z-50"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      )}

      {/* Sidebar with mobile overlay */}
      <div className={`
        fixed inset-0 lg:relative
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-200 ease-in-out
        lg:w-64 z-40
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Persistent header with logo and logout */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4 lg:p-6 flex items-center gap-4">
          {/* Mobile: spacer for menu button */}
          <div className="lg:hidden w-10" /> 
          
          <Link href="/" className="lg:hidden flex-1 flex justify-center">
            <Logo className="w-auto h-8" />
          </Link>
          
          {/* Logout button - positioned at right edge */}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-gray-600 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 lg:mr-2" />
            <span className="hidden lg:inline">Logout</span>
          </Button>
        </div>
        
        {/* Content area */}
        <div className="p-6 pt-4 lg:pt-6">
          {children}
        </div>
      </main>

      {/* Floating Add Button */}
      <AddButton />

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 lg:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}