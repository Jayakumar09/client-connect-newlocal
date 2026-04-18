import { Bell, Menu } from 'lucide-react';
import { BRAND_NAME } from '@/lib/branding';
import { NotificationBell } from '@/components/NotificationBell';

interface MobileHeaderProps {
  onMenuOpen: () => void;
  showNotification?: boolean;
}

export function MobileHeader({ onMenuOpen, showNotification = true }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-3">
        <button
          type="button"
          onClick={onMenuOpen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-brand-50"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3 px-2">
          <div className="flex min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-800">{BRAND_NAME}</h1>
          </div>
        </div>

        {showNotification && (
          <div className="relative">
            <NotificationBell />
          </div>
        )}
      </div>
    </header>
  );
}

export default MobileHeader;
