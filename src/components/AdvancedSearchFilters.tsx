import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Filter, ChevronDown, ChevronUp, Lock, Search, X as ClearIcon, Crown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const SHOW_UPGRADE = import.meta.env.VITE_ENABLE_UPGRADE === 'true';

interface AdvancedSearchFiltersProps {
  isPaidUser: boolean;
  onFiltersChange: (filters: SearchFilters) => void;
  onUpgradeClick: () => void;
}

export interface SearchFilters {
  searchTerm: string;
  gender: string;
  religion: string;
  caste: string;
  city: string;
  education: string;
  income: string;
  maritalStatus: string;
  ageMin: string;
  ageMax: string;
}

const educationOptions = [
  'BE', 'B.Tech', 'ME', 'M.Tech', 'MBBS', 'MD', 'MBA', 'MCA', 'BCA', 
  'B.Com', 'M.Com', 'BA', 'MA', 'B.Sc', 'M.Sc', 'PhD', 'Diploma', 
  'ITI', '12th Pass', '10th Pass', 'Other'
];

const incomeRanges = [
  'Below 2 Lakhs',
  '2-5 Lakhs',
  '5-10 Lakhs',
  '10-15 Lakhs',
  '15-25 Lakhs',
  '25-50 Lakhs',
  'Above 50 Lakhs'
];

const casteOptions = [
  'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Scheduled Caste', 
  'Scheduled Tribe', 'OBC', 'General', 'Adi Dravidar', 'Nadar',
  'Gounder', 'Mudaliar', 'Pillai', 'Chettiar', 'Naidu', 'Reddy',
  'Thevar', 'Vanniyar', 'Yadav', 'Maratha', 'Rajput', 'Jat',
  'Kayastha', 'Bania', 'Agarwal', 'Gupta', 'Other'
];

export const AdvancedSearchFilters = ({ 
  isPaidUser, 
  onFiltersChange,
  onUpgradeClick 
}: AdvancedSearchFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    gender: 'all',
    religion: 'all',
    caste: '',
    city: '',
    education: '',
    income: '',
    maritalStatus: 'all',
    ageMin: '',
    ageMax: ''
  });

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: SearchFilters = {
      searchTerm: '',
      gender: 'all',
      religion: 'all',
      caste: '',
      city: '',
      education: '',
      income: '',
      maritalStatus: 'all',
      ageMin: '',
      ageMax: ''
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && value !== 'all' && value !== ''
  ).length;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 sm:p-4 mb-2 sm:mb-6 shadow-sm">
      {/* Basic Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, location, occupation..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-10 border-pink-200 focus:ring-pink-500 text-sm sm:text-base"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filters.gender} onValueChange={(v) => updateFilter('gender', v)}>
            <SelectTrigger className="w-28 sm:w-32 border-pink-200 text-sm">
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="male">Groom</SelectItem>
              <SelectItem value="female">Bride</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.religion} onValueChange={(v) => updateFilter('religion', v)}>
            <SelectTrigger className="w-28 sm:w-32 border-pink-200 text-sm">
              <SelectValue placeholder="Religion" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="hindu">Hindu</SelectItem>
              <SelectItem value="muslim">Muslim</SelectItem>
              <SelectItem value="christian">Christian</SelectItem>
              <SelectItem value="sikh">Sikh</SelectItem>
              <SelectItem value="jain">Jain</SelectItem>
              <SelectItem value="buddhist">Buddhist</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced Filters Collapsible */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              Advanced Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <ClearIcon className="h-4 w-4 mr-1" />
              Clear all
            </Button>
          )}
        </div>

        <CollapsibleContent className="mt-3 space-y-3">
          {!isPaidUser && SHOW_UPGRADE && (
            <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 text-purple-700">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">Premium filters require a paid subscription</span>
              </div>
              <Button 
                variant="link" 
                className="text-purple-600 p-0 h-auto text-sm"
                onClick={onUpgradeClick}
              >
                Upgrade to unlock all filters →
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Caste Filter */}
            <div className="relative">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Caste</label>
              <Select 
                value={filters.caste} 
                onValueChange={(v) => updateFilter('caste', v)}
                disabled={!isPaidUser}
              >
                <SelectTrigger className={`border-pink-200 ${!isPaidUser ? 'opacity-50' : ''}`}>
                  <SelectValue placeholder="Select caste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Castes</SelectItem>
                  {casteOptions.map(caste => (
                    <SelectItem key={caste} value={caste.toLowerCase()}>{caste}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isPaidUser && <Lock className="absolute right-8 top-8 h-4 w-4 text-muted-foreground" />}
            </div>

            {/* City Filter */}
            <div className="relative">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">City</label>
              <Input
                placeholder="Enter city"
                value={filters.city}
                onChange={(e) => updateFilter('city', e.target.value)}
                disabled={!isPaidUser}
                className={`border-pink-200 ${!isPaidUser ? 'opacity-50' : ''}`}
              />
              {!isPaidUser && <Lock className="absolute right-3 top-8 h-4 w-4 text-muted-foreground" />}
            </div>

            {/* Education Filter */}
            <div className="relative">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Education</label>
              <Select 
                value={filters.education} 
                onValueChange={(v) => updateFilter('education', v)}
                disabled={!isPaidUser}
              >
                <SelectTrigger className={`border-pink-200 ${!isPaidUser ? 'opacity-50' : ''}`}>
                  <SelectValue placeholder="Select education" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Education</SelectItem>
                  {educationOptions.map(edu => (
                    <SelectItem key={edu} value={edu.toLowerCase()}>{edu}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isPaidUser && <Lock className="absolute right-8 top-8 h-4 w-4 text-muted-foreground" />}
            </div>

            {/* Income Filter */}
            <div className="relative">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Annual Income</label>
              <Select 
                value={filters.income} 
                onValueChange={(v) => updateFilter('income', v)}
                disabled={!isPaidUser}
              >
                <SelectTrigger className={`border-pink-200 ${!isPaidUser ? 'opacity-50' : ''}`}>
                  <SelectValue placeholder="Select income" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Incomes</SelectItem>
                  {incomeRanges.map(range => (
                    <SelectItem key={range} value={range.toLowerCase()}>{range}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isPaidUser && <Lock className="absolute right-8 top-8 h-4 w-4 text-muted-foreground" />}
            </div>

            {/* Marital Status Filter */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Marital Status</label>
              <Select value={filters.maritalStatus} onValueChange={(v) => updateFilter('maritalStatus', v)}>
                <SelectTrigger className="border-pink-200">
                  <SelectValue placeholder="Marital Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="never_married">Never Married</SelectItem>
                  <SelectItem value="divorced">Divorced</SelectItem>
                  <SelectItem value="widowed">Widowed</SelectItem>
                  <SelectItem value="awaiting_divorce">Awaiting Divorce</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Age Range */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Age Range</label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.ageMin}
                  onChange={(e) => updateFilter('ageMin', e.target.value)}
                  className="border-pink-200 w-24"
                  min="18"
                  max="99"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.ageMax}
                  onChange={(e) => updateFilter('ageMax', e.target.value)}
                  className="border-pink-200 w-24"
                  min="18"
                  max="99"
                />
                <span className="text-muted-foreground text-sm">years</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default AdvancedSearchFilters;
