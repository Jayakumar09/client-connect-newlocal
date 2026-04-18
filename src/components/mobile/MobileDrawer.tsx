import { Home, Image, LogOut, Settings, User, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface MenuItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  profileId?: string;
}

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: Home, path: '/browse' },
  { label: 'My Profile', icon: User, path: '/client-dashboard' },
  { label: 'Gallery', icon: Image, path: '/client-dashboard#gallery' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export function MobileDrawer({ open, onClose, userName = 'User', profileId }: MobileDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path.includes('#')) {
      return location.pathname === path.split('#')[0];
    }
    return location.pathname === path;
  };

  const handleNavigate = (path: string) => {
    onClose();
    if (path.includes('#')) {
      const [route, hash] = path.split('#');
      navigate(route);
      setTimeout(() => {
        const element = document.getElementById(hash);
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      navigate(path);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition md:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[82%] max-w-xs flex-col bg-white shadow-2xl transition-transform duration-300 md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-brand-100 px-4 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">Menu</p>
            <p className="text-sm text-slate-500">Client dashboard</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-brand-50"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 p-4 text-white shadow-soft">
            <p className="text-sm text-white/80">Logged in as</p>
            <p className="mt-1 text-lg font-semibold">{userName}</p>
            {profileId && (
              <p className="text-sm text-white/90">{profileId}</p>
            )}
          </div>

          <nav className="space-y-2">
            {menuItems.map(({ label, icon: Icon, path }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleNavigate(path)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                  isActive(path)
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-slate-700 hover:bg-brand-50'
                }`}
              >
                <Icon size={18} className={isActive(path) ? 'text-brand-600' : 'text-brand-500'} />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-brand-100 p-4">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-200 px-4 py-3 font-medium text-brand-700 hover:bg-brand-50"
            onClick={() => {
              onClose();
              navigate('/client-auth');
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default MobileDrawer;
