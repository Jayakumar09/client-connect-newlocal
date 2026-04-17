import { useNavigate, useLocation } from "react-router-dom";
import { Home, User, Image, Bell, Settings, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/browse", icon: Home, label: "Home" },
    { path: "/shortlists", icon: Heart, label: "Interest" },
    { path: "/client-dashboard", icon: Image, label: "Gallery" },
    { path: "/notifications", icon: Bell, label: "Alert" },
    { path: "/client-profile", icon: User, label: "Profile" },
  ];

  const isActive = (path: string) => {
    if (path === "/browse") return location.pathname === "/browse";
    if (path === "/shortlists") return location.pathname === "/shortlists";
    if (path === "/client-profile") return location.pathname === "/client-profile";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            size="sm"
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center h-14 w-14 px-0 py-0 rounded-xl transition-all ${
              isActive(item.path)
                ? "text-pink-600 bg-pink-50 font-semibold"
                : "text-gray-400 hover:text-pink-500 hover:bg-gray-50"
            }`}
          >
            <item.icon className={`h-5 w-5 ${isActive(item.path) ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
            <span className={`text-[10px] mt-0.5 ${isActive(item.path) ? 'font-semibold' : 'font-medium'}`}>
              {item.label}
            </span>
          </Button>
        ))}
      </div>
    </nav>
  );
}

export default MobileBottomNav;