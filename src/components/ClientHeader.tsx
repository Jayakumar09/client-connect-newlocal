import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, LogOut, ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { BRAND_LOGO, BRAND_NAME } from "@/lib/branding";

interface ClientHeaderProps {
  showBackButton?: boolean;
  showNotificationBell?: boolean;
  showInterestsButton?: boolean;
  showUpgradeButton?: boolean;
  showMyProfileButton?: boolean;
  showLogoutButton?: boolean;
  showChatButton?: boolean;
  showBackToDashboard?: boolean;
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
  showBackToDashboard = false,
  onSignOut,
  loading = false,
}: ClientHeaderProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-pink-600" />
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <img
            src={BRAND_LOGO}
            alt={BRAND_NAME}
            className="w-10 h-10 md:w-12 md:h-12 object-contain flex-shrink-0"
          />
          <h1 className="text-lg md:text-xl font-cursive font-semibold bg-gradient-to-r from-pink-600 via-purple-600 to-pink-500 bg-clip-text text-transparent truncate max-w-[180px] sm:max-w-none">
            {BRAND_NAME}
          </h1>
        </div>

        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {showInterestsButton && (
            <Button
              onClick={() => navigate("/shortlists")}
              variant="outline"
              className="border-pink-200 hover:bg-pink-50 text-xs md:text-sm"
            >
              <Heart className="w-4 h-4 mr-1 text-pink-500" />
              <span className="hidden sm:inline">Interests</span>
            </Button>
          )}

          {showChatButton && (
            <Button
              onClick={() => navigate("/client-messages")}
              variant="outline"
              className="border-pink-200 hover:bg-pink-50 text-xs md:text-sm"
              title="Chat with admin"
            >
              <MessageSquare className="w-4 h-4 mr-1 text-pink-500" />
              <span className="hidden sm:inline">Chat</span>
            </Button>
          )}

          {showUpgradeButton && (
            <Button
              onClick={() => navigate("/plans")}
              variant="default"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg text-xs md:text-sm"
            >
              Upgrade
            </Button>
          )}

          {showMyProfileButton && (
            <Button
              onClick={() => navigate("/client-profile")}
              variant="outline"
              className="border-pink-200 hover:bg-pink-50 text-xs md:text-sm"
            >
              <span className="hidden sm:inline">My Profile</span>
              <span className="sm:hidden">Profile</span>
            </Button>
          )}

          {showBackToDashboard && (
            <Button
              onClick={() => navigate("/browse")}
              variant="outline"
              className="border-pink-200 hover:bg-pink-50 text-xs md:text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Dashboard</span>
            </Button>
          )}

          {showNotificationBell && <NotificationBell />}

          {showLogoutButton && onSignOut && (
            <Button
              onClick={onSignOut}
              variant="outline"
              className="border-pink-200 hover:bg-pink-50 text-xs md:text-sm"
            >
              <LogOut className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">Sign Out</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export default ClientHeader;
