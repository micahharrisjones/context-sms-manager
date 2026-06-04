import { useEffect } from "react";
import { MessageSquare, LayoutGrid, Search, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { BottomTabs } from "./BottomTabs";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: "Feed", icon: MessageSquare, route: "/", pendo: "rail-tab-feed" },
  { label: "Boards", icon: LayoutGrid, route: "/boards", pendo: "rail-tab-boards" },
  { label: "Search", icon: Search, route: "/search", pendo: "rail-tab-search" },
  { label: "Profile", icon: User, route: "/profile", pendo: "rail-tab-profile" },
];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

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

  const isActive = (route: string) => {
    if (route === "/") {
      return location === "/" || location === "/all-texts" || (location.startsWith("/tag/") && !location.startsWith("/tag/shared/") && !location.startsWith("/tag/private/"));
    }
    if (route === "/boards") {
      return location === "/boards" || location.startsWith("/tag/shared/") || location.startsWith("/tag/private/");
    }
    return location.startsWith(route);
  };

  return (
    <div className="flex h-screen relative bg-[#faf6f3]">
      {/* Desktop icon rail */}
      <aside className="hidden lg:flex flex-col items-center w-[72px] bg-white shadow-[2px_0_10px_rgba(0,0,0,0.08)] flex-shrink-0 h-screen" data-pendo="desktop-icon-rail">
        <Link href="/" className="flex items-center justify-center py-5" data-pendo="rail-logo">
          <img src="/aside-logo-loader.png" alt="Aside" className="w-8 h-8 object-contain" />
        </Link>

        <nav className="flex flex-col items-center gap-2 mt-4 flex-1">
          {navItems.map((item) => {
            const active = isActive(item.route);
            const Icon = item.icon;
            return (
              <Link
                key={item.route}
                href={item.route}
                className="relative flex flex-col items-center justify-center w-14 h-14 rounded-lg group"
                data-pendo={item.pendo}
              >
                {active && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#b95827]" />
                )}
                <Icon
                  className={`w-5 h-5 ${active ? "text-[#b95827]" : "text-[#263d57]/60 group-hover:text-[#263d57]"}`}
                  fill={active ? "#b95827" : "none"}
                  strokeWidth={active ? 2 : 1.5}
                />
                <span
                  className={`mt-1 text-[10px] ${
                    active ? "font-semibold text-[#b95827]" : "text-[#263d57]/60 group-hover:text-[#263d57]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden lg:h-screen">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-0">
          <div className="p-6">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <BottomTabs />
    </div>
  );
}
