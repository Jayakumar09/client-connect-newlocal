import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, LogOut, ArrowLeft, Loader2, MessageSquare, Bell } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { MobileMenuDrawer } from "@/components/MobileMenuDrawer";
import { BRAND_NAME } from "@/lib/branding";

interface ClientHeaderProps {
  showBackButton?: boolean;
  showNotificationBell?: boolean;
  showInterestsButton?: boolean;
  showUpgradeButton?: boolean;
  showMyProfileButton?: boolean;
  showLogoutButton?: boolean;
  showChatButton?: boolean;
  onSignOut?: () => void;
  loading?: boolean;
}

export function ClientHeader({
  showBackButton = false,
  showNotificationBell = true,
  showInterestsButton = false,
  showUpgradeButton = false,
  showMyProfileButton = false,
  showLogoutButton = false,
  showChatButton = false,
  onSignOut,
  loading = false,
}: ClientHeaderProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-center h-12">
          <Loader2 className="h-5 w-5 animate-spin text-pink-500" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="flex items-center justify-between h-12 px-3">
        {/* Left side - Menu/Back + Title */}
        <div className="flex items-center gap-2 min-w-0">
          <MobileMenuDrawer onSignOut={onSignOut} />
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-8 w-8 -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h1 className="text-base font-semibold text-gray-800 truncate">
            {BRAND_NAME}
          </h1>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-1">
          {showInterestsButton && (
            <Button
              onClick={() => navigate("/shortlists")}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <Heart className="h-4 w-4 text-pink-500" />
            </Button>
          )}

          {showChatButton && (
            <Button
              onClick={() => navigate("/client-messages")}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Chat"
            >
              <MessageSquare className="h-4 w-4 text-pink-500" />
            </Button>
          )}

          {showUpgradeButton && (
            <Button
              onClick={() => navigate("/plans")}
              size="sm"
              className="h-8 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs px-3"
            >
              Upgrade
            </Button>
          )}

          {showMyProfileButton && (
            <Button
              onClick={() => navigate("/client-profile")}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="My Profile"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          {showNotificationBell && (
            <div className="relative">
              <NotificationBell />
            </div>
          )}

          {showLogoutButton && onSignOut && (
            <Button
              onClick={onSignOut}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export default ClientHeader;