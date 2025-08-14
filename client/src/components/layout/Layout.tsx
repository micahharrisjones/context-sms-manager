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
        {/* Simple mobile header with centered logo */}
        <div className="lg:hidden sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4 flex items-center justify-center">
          <Link href="/">
            <Logo className="w-auto h-8" />
          </Link>
        </div>
        
        {/* Content area */}
        <div className="p-6">
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