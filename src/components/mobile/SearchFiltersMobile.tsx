import { ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface SearchFiltersMobileProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  gender: string;
  onGenderChange: (value: string) => void;
  religion: string;
  onReligionChange: (value: string) => void;
  isPaidUser?: boolean;
  onUpgradeClick?: () => void;
}

export function SearchFiltersMobile({
  searchTerm,
  onSearchChange,
  gender,
  onGenderChange,
  religion,
  onReligionChange,
  isPaidUser = false,
  onUpgradeClick,
}: SearchFiltersMobileProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className="rounded-[24px] border border-brand-100 bg-white p-3 shadow-soft">
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, location, occupation..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-12 w-full rounded-2xl border border-brand-100 bg-brand-50/40 pl-12 pr-4 text-base outline-none ring-0 placeholder:text-slate-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="relative">
          <select
            value={gender}
            onChange={(e) => onGenderChange(e.target.value)}
            className="h-12 w-full appearance-none rounded-2xl border border-brand-100 bg-white px-4 pr-8 text-base text-slate-700 outline-none focus:border-brand-300"
          >
            <option value="all">All Gender</option>
            <option value="male">Groom</option>
            <option value="female">Bride</option>
          </select>
          <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>

        <div className="relative">
          <select
            value={religion}
            onChange={(e) => onReligionChange(e.target.value)}
            className="h-12 w-full appearance-none rounded-2xl border border-brand-100 bg-white px-4 pr-8 text-base text-slate-700 outline-none focus:border-brand-300"
          >
            <option value="all">All Religion</option>
            <option value="hindu">Hindu</option>
            <option value="muslim">Muslim</option>
            <option value="christian">Christian</option>
            <option value="sikh">Sikh</option>
            <option value="jain">Jain</option>
            <option value="buddhist">Buddhist</option>
            <option value="other">Other</option>
          </select>
          <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mt-2 flex h-11 items-center gap-2 rounded-2xl px-2 text-base font-semibold text-slate-800 hover:bg-brand-50"
      >
        <ChevronDown size={18} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        Advanced Filters
        {!isPaidUser && (
          <span className="ml-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-2 py-0.5 text-xs font-medium text-white">
            Premium
          </span>
        )}
      </Button>

      {showAdvanced && (
        <div className="mt-3 space-y-3 border-t border-brand-100 pt-3">
          {!isPaidUser && onUpgradeClick && (
            <div className="rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 p-3 text-center">
              <p className="text-sm font-medium text-purple-700">Unlock advanced filters</p>
              <Button
                size="sm"
                onClick={onUpgradeClick}
                className="mt-2 bg-gradient-to-r from-pink-500 to-purple-500 text-xs"
              >
                Upgrade Now
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default SearchFiltersMobile;
