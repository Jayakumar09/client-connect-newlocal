import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Users, 
  UserCheck, 
  MessageSquare, 
  Bell, 
  HelpCircle, 
  CreditCard, 
  Receipt, 
  CalendarCheck,
  ChevronDown 
} from "lucide-react";
import { useState } from "react";

interface NavItemProps {
  title: string;
  href: string;
  icon: React.ReactNode;
  description: string;
  onClick?: () => void;
}

const NavItem = ({ title, href, icon, description, onClick }: NavItemProps) => (
  <Link
    to={href}
    onClick={onClick}
    className={cn(
      "flex items-start gap-3 select-none rounded-md p-3 leading-none no-underline outline-none transition-colors",
      "hover:bg-accent hover:text-accent-foreground"
    )}
  >
    <div className="mt-0.5 text-primary">{icon}</div>
    <div className="space-y-1">
      <div className="text-sm font-medium leading-none">{title}</div>
      <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
        {description}
      </p>
    </div>
  </Link>
);

interface DropdownMenuProps {
  label: string;
  children: React.ReactNode;
  isActive?: boolean;
}

const DropdownMenu = ({ label, children, isActive }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className={cn(
          "inline-flex h-10 items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive && "border-b-2 border-primary"
        )}
      >
        {label}
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </button>
      
      {isOpen && (
        <div className="absolute left-0 top-full z-50 min-w-[280px] rounded-md border bg-popover p-2 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
};

interface DashboardNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const DashboardNav = ({ activeTab, onTabChange }: DashboardNavProps) => {
  return (
    <nav className="flex items-center gap-1">
      {/* Home */}
      <button
        onClick={() => window.location.href = "/dashboard"}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground"
        )}
      >
        Home
      </button>

      {/* Features */}
      <DropdownMenu label="Features">
        <NavItem
          title="Messages"
          href="/messages"
          icon={<MessageSquare className="h-4 w-4" />}
          description="Send and receive messages"
        />
        <NavItem
          title="Notifications"
          href="/notifications"
          icon={<Bell className="h-4 w-4" />}
          description="View all notifications"
        />
        <NavItem
          title="Help"
          href="/help"
          icon={<HelpCircle className="h-4 w-4" />}
          description="Get help and support"
        />
      </DropdownMenu>

      {/* Profiles */}
      <DropdownMenu 
        label="Profiles" 
        isActive={activeTab === "admin" || activeTab === "client"}
      >
        <button
          onClick={() => onTabChange("admin")}
          className={cn(
            "flex w-full items-start gap-3 select-none rounded-md p-3 leading-none outline-none transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            activeTab === "admin" && "bg-accent"
          )}
        >
          <div className="mt-0.5 text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div className="space-y-1 text-left">
            <div className="text-sm font-medium leading-none">Admin Records</div>
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
              Manage admin-created person records
            </p>
          </div>
        </button>
        <button
          onClick={() => onTabChange("client")}
          className={cn(
            "flex w-full items-start gap-3 select-none rounded-md p-3 leading-none outline-none transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            activeTab === "client" && "bg-accent"
          )}
        >
          <div className="mt-0.5 text-primary">
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="space-y-1 text-left">
            <div className="text-sm font-medium leading-none">Client Profiles</div>
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
              View and manage client profiles
            </p>
          </div>
        </button>
      </DropdownMenu>

      {/* Premium (Admin Only) */}
      <DropdownMenu label="Premium">
        <NavItem
          title="Payment Verification"
          href="/admin-payments"
          icon={<Receipt className="h-4 w-4" />}
          description="Verify pending payments & activate subscriptions"
        />
        <NavItem
          title="All Subscriptions"
          href="/subscriptions"
          icon={<CalendarCheck className="h-4 w-4" />}
          description="View all user subscriptions"
        />
        <NavItem
          title="Plans Info"
          href="/plans"
          icon={<CreditCard className="h-4 w-4" />}
          description="View plan details and pricing"
        />
      </DropdownMenu>
    </nav>
  );
};

export default DashboardNav;
