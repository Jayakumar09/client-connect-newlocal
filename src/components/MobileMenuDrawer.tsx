import { useNavigate, useLocation } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Menu,
  Home,
  User,
  UserPen,
  Briefcase,
  MapPin,
  Users,
  Heart,
  Image,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";

interface MenuItem {
  path: string;
  icon: React.ElementType;
  label: string;
  badge?: string;
}

interface MobileMenuDrawerProps {
  onSignOut?: () => void;
}

const menuSections: MenuItem[][] = [
  [
    { path: "/browse", icon: Home, label: "Dashboard" },
    { path: "/client-dashboard", icon: UserPen, label: "Basic Info" },
    { path: "/client-dashboard#personal", icon: User, label: "Personal Details" },
    { path: "/client-dashboard#career", icon: Briefcase, label: "Career & Education" },
  ],
  [
    { path: "/client-dashboard#location", icon: MapPin, label: "Location" },
    { path: "/client-dashboard#family", icon: Users, label: "Family Details" },
    { path: "/client-dashboard#about", icon: Heart, label: "About Me" },
  ],
  [
    { path: "/client-profile", icon: Image, label: "Profile Photo" },
    { path: "/client-dashboard", icon: Image, label: "Gallery", badge: "8" },
  ],
];

export function MobileMenuDrawer({ onSignOut }: MobileMenuDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/browse") return location.pathname === "/browse";
    return location.pathname.startsWith(path.split("#")[0]);
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
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden flex-shrink-0 text-pink-600 hover:bg-pink-50"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[280px] sm:w-[320px] bg-gradient-to-b from-pink-50 via-white to-purple-50 p-0"
      >
        <SheetHeader className="border-b border-pink-100 px-4 py-4 bg-gradient-to-r from-pink-100 to-purple-100">
          <SheetTitle className="text-pink-700 flex items-center gap-2">
            <span className="text-xl">👩‍❤️‍👨</span>
            Menu
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full overflow-y-auto py-4">
          {menuSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="px-3 py-2">
              {section.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-colors ${
                    isActive(item.path)
                      ? "bg-gradient-to-r from-pink-100 to-purple-100 text-pink-700"
                      : "text-gray-700 hover:bg-pink-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-pink-500" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <Badge className="bg-pink-100 text-pink-700 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          ))}

          <div className="border-t border-pink-100 mt-auto pt-4 px-3">
            <button
              onClick={() => {
                onSignOut?.();
                navigate("/client-auth");
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium text-sm">Logout</span>
              <ChevronRight className="h-4 w-4 ml-auto" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileMenuDrawer;