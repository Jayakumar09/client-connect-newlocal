import { useNavigate, useLocation } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Home,
  User,
  Briefcase,
  MapPin,
  Users,
  Heart,
  Image,
  LogOut,
} from "lucide-react";

interface MenuItem {
  path: string;
  icon: React.ElementType;
  label: string;
}

interface MobileMenuDrawerProps {
  onSignOut?: () => void;
}

const menuItems: MenuItem[] = [
  { path: "/browse", icon: Home, label: "Home" },
  { path: "/client-dashboard", icon: User, label: "My Profile" },
  { path: "/client-dashboard#career", icon: Briefcase, label: "Career" },
  { path: "/client-dashboard#location", icon: MapPin, label: "Location" },
  { path: "/client-dashboard#family", icon: Users, label: "Family" },
  { path: "/shortlists", icon: Heart, label: "Interests" },
  { path: "/notifications", icon: Image, label: "Notifications" },
];

export function MobileMenuDrawer({ onSignOut }: MobileMenuDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path.includes("#")) {
      path = path.split("#")[0];
    }
    if (path === "/browse") return location.pathname === "/browse";
    if (path === "/shortlists") return location.pathname === "/shortlists";
    if (path === "/notifications") return location.pathname === "/notifications";
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (path: string) => {
    if (path.includes("#")) {
      const [route, hash] = path.split("#");
      navigate(route);
      setTimeout(() => {
        const element = document.getElementById(hash);
        element?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      navigate(path);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b border-gray-100 px-4 py-3 text-left">
          <SheetTitle className="text-base font-semibold text-gray-800">
            Menu
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col py-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={`flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                isActive(item.path)
                  ? "bg-pink-50 text-pink-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}

          <div className="border-t border-gray-100 mt-2 pt-2">
            <button
              onClick={() => {
                onSignOut?.();
                navigate("/client-auth");
              }}
              className="flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileMenuDrawer;