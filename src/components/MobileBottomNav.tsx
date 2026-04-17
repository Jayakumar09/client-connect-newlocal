import { useNavigate, useLocation } from "react-router-dom";
import { Home, User, Image, Bell, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileBottomNavProps {
  onSignOut?: () => void;
}

export function MobileBottomNav({ onSignOut }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/browse", icon: Home, label: "Home" },
    { path: "/client-profile", icon: User, label: "Profile" },
    { path: "/client-dashboard", icon: Image, label: "Gallery" },
    { path: "/notifications", icon: Bell, label: "Alerts" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  const isActive = (path: string) => {
    if (path === "/browse") return location.pathname === "/browse";
    if (path === "/client-dashboard") return location.pathname === "/client-dashboard";
    if (path === "/settings") return location.pathname === "/settings";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-sm border-t border-pink-100 shadow-lg safe-area-pb">
      <div className="flex items-center justify-around py-2 px-1">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            size="sm"
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center h-12 min-w-[60px] px-1 py-1 rounded-lg transition-colors ${
              isActive(item.path)
                ? "text-pink-600 bg-pink-50"
                : "text-muted-foreground hover:text-pink-600 hover:bg-pink-50/50"
            }`}
          >
            <item.icon className="h-5 w-5 mb-0.5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Button>
        ))}
      </div>
    </nav>
  );
}

export default MobileBottomNav;