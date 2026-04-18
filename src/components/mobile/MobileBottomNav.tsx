import { Bell, Heart, Home, Image, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const tabs = [
  { key: 'home', label: 'Home', icon: Home, path: '/browse' },
  { key: 'interest', label: 'Interest', icon: Heart, path: '/shortlists' },
  { key: 'gallery', label: 'Gallery', icon: Image, path: '/client-dashboard' },
  { key: 'alert', label: 'Alert', icon: Bell, path: '/notifications' },
  { key: 'profile', label: 'Profile', icon: User, path: '/client-profile' },
];

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveKey = () => {
    if (location.pathname === '/browse') return 'home';
    if (location.pathname === '/shortlists') return 'interest';
    if (location.pathname.startsWith('/client-dashboard') || location.pathname === '/client-dashboard') return 'gallery';
    if (location.pathname === '/notifications') return 'alert';
    if (location.pathname === '/client-profile') return 'profile';
    return 'home';
  };

  const active = getActiveKey();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto grid h-[74px] max-w-md grid-cols-5 px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ key, label, icon: Icon, path }) => {
          const isActive = key === active;
          return (
            <button
              type="button"
              key={key}
              onClick={() => navigate(path)}
              className={`mx-1 my-2 flex flex-col items-center justify-center rounded-2xl transition ${
                isActive ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:text-brand-500'
              }`}
            >
              <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
              <span className={`mt-1 text-[12px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
