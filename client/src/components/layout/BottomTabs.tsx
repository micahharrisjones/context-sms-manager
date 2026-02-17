import { Link, useLocation } from "wouter";
import { MessageSquare, LayoutGrid, Search, User } from "lucide-react";

const tabs = [
  { label: "Inbox", icon: MessageSquare, route: "/", pendo: "bottom-tab-inbox" },
  { label: "Boards", icon: LayoutGrid, route: "/boards", pendo: "bottom-tab-boards" },
  { label: "Search", icon: Search, route: "/search", pendo: "bottom-tab-search" },
  { label: "Profile", icon: User, route: "/profile", pendo: "bottom-tab-profile" },
];

export function BottomTabs() {
  const [location] = useLocation();

  const isActive = (route: string) => {
    if (route === "/") {
      return location === "/" || location === "/all-texts" || location.startsWith("/tag/");
    }
    return location.startsWith(route);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e3cac0] lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-pendo="bottom-tabs"
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.route);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.route}
              href={tab.route}
              className="flex flex-col items-center justify-center flex-1 h-full"
              data-pendo={tab.pendo}
            >
              <Icon
                className={`w-6 h-6 ${active ? "text-[#b95827]" : "text-[#263d57]/60"}`}
                fill={active ? "#b95827" : "none"}
                strokeWidth={active ? 2 : 1.5}
              />
              <span
                className={`mt-1 ${
                  active
                    ? "text-xs font-semibold text-[#b95827]"
                    : "text-[10px] text-[#263d57]/60"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
