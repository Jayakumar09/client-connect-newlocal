import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, Heart, Eye, Lock } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import ClientProfileCard from "@/components/ClientProfileCard";
import ClientProfileViewDialog from "@/components/ClientProfileViewDialog";
import ViewLimitBanner from "@/components/ViewLimitBanner";
import { useProfileViews } from "@/hooks/useProfileViews";
import { ClientHeader } from "@/components/ClientHeader";
import AdvancedSearchFilters, { SearchFilters } from "@/components/AdvancedSearchFilters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Mobile components based on reference design
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileDrawer } from "@/components/mobile/MobileDrawer";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { SearchFiltersMobile } from "@/components/mobile/SearchFiltersMobile";
import { ProfileCardMobile } from "@/components/mobile/ProfileCardMobile";

type ClientProfile = Tables<"client_profiles"> & {
  match_status?: 'not_matched' | 'matched' | null;
  matched_with_id?: string | null;
  match_remarks?: string | null;
  profile_id?: string;
};

const SHOW_UPGRADE_UI = import.meta.env.VITE_ENABLE_UPGRADE === 'true';

const Browse = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ClientProfile | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState<string>("User");
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

  const { 
    isPaidUser, 
    getRemainingViews, 
    MAX_FREE_VIEWS, 
    recordProfileView,
    canViewProfile,
    loading: viewsLoading 
  } = useProfileViews();

  useEffect(() => {
    checkAuthAndFetch();
  }, [navigate]);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/client-auth");
      return;
    }
    setCurrentUserId(session.user.id);
    
    if (session.user.user_metadata?.full_name) {
      setUserName(session.user.user_metadata.full_name);
    } else if (session.user.email) {
      setUserName(session.user.email.split('@')[0]);
    }
    
    const isAdmin = session.user.email === "vijayalakshmijayakumar45@gmail.com";
    if (isAdmin) {
      navigate("/dashboard");
      return;
    }
    
    await fetchProfiles();
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("is_profile_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error("Error fetching profiles:", error);
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const filteredProfiles = useMemo(() => {
    let filtered = profiles.filter(p => p.user_id !== currentUserId);

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.full_name.toLowerCase().includes(term) ||
        p.city?.toLowerCase().includes(term) ||
        p.state?.toLowerCase().includes(term) ||
        p.occupation?.toLowerCase().includes(term) ||
        p.education?.toLowerCase().includes(term)
      );
    }

    if (filters.gender !== "all") {
      filtered = filtered.filter(p => p.gender === filters.gender);
    }

    if (filters.religion !== "all") {
      filtered = filtered.filter(p => p.religion === filters.religion);
    }

    if (filters.maritalStatus !== "all") {
      filtered = filtered.filter(p => p.marital_status === filters.maritalStatus);
    }

    if (filters.ageMin || filters.ageMax) {
      filtered = filtered.filter(p => {
        const age = calculateAge(p.date_of_birth);
        const minAge = filters.ageMin ? parseInt(filters.ageMin) : 0;
        const maxAge = filters.ageMax ? parseInt(filters.ageMax) : 999;
        return age >= minAge && age <= maxAge;
      });
    }

    if (isPaidUser) {
      if (filters.caste && filters.caste !== 'all') {
        filtered = filtered.filter(p => 
          p.caste?.toLowerCase().includes(filters.caste.toLowerCase())
        );
      }

      if (filters.city) {
        filtered = filtered.filter(p => 
          p.city?.toLowerCase().includes(filters.city.toLowerCase())
        );
      }

      if (filters.education && filters.education !== 'all') {
        filtered = filtered.filter(p => 
          p.education?.toLowerCase().includes(filters.education.toLowerCase())
        );
      }

      if (filters.income && filters.income !== 'all') {
        filtered = filtered.filter(p => 
          p.annual_income?.toLowerCase().includes(filters.income.toLowerCase())
        );
      }
    }

    return filtered;
  }, [profiles, filters, currentUserId, isPaidUser]);

  const displayedProfiles = useMemo(() => {
    if (isPaidUser) return filteredProfiles;
    return filteredProfiles.slice(0, MAX_FREE_VIEWS);
  }, [filteredProfiles, isPaidUser, MAX_FREE_VIEWS]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Signed out successfully");
      navigate("/client-auth");
    }
  };

  const handleViewProfile = async (profile: ClientProfile) => {
    if (!canViewProfile(profile.user_id)) {
      setLimitDialogOpen(true);
      return;
    }

    const canProceed = await recordProfileView(profile.user_id);
    if (!canProceed) {
      setLimitDialogOpen(true);
      return;
    }

    setSelectedProfile(profile);
    setViewDialogOpen(true);
  };

  if (loading || viewsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
        <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
      </div>
    );
  }

  // Mobile Layout (< 768px)
  const MobileLayout = () => (
    <div className="min-h-screen bg-[#fdf4fa]">
      <MobileHeader onMenuOpen={() => setDrawerOpen(true)} />
      <MobileDrawer 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)}
        userName={userName}
      />

      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-3 pb-[110px] pt-4">
        {/* Dashboard Header */}
        <section className="rounded-[24px] border border-brand-100 bg-white p-4 shadow-soft">
          <h1 className="text-[22px] font-bold text-brand-700">Dashboard</h1>
          <p className="mt-2 text-lg text-slate-500">Browse matching profiles and manage your activity</p>
        </section>

        {/* View Limit Banner - Mobile */}
        <ViewLimitBanner 
          remainingViews={getRemainingViews()} 
          maxViews={MAX_FREE_VIEWS}
          isPaidUser={isPaidUser}
        />

        {/* Search Filters - Mobile */}
        <SearchFiltersMobile
          searchTerm={filters.searchTerm}
          onSearchChange={(value) => setFilters({ ...filters, searchTerm: value })}
          gender={filters.gender}
          onGenderChange={(value) => setFilters({ ...filters, gender: value })}
          religion={filters.religion}
          onReligionChange={(value) => setFilters({ ...filters, religion: value })}
          isPaidUser={isPaidUser}
          onUpgradeClick={() => navigate('/plans')}
        />

        {/* Results count - Mobile */}
        <div className="space-y-1 text-slate-600">
          <p className="text-[18px] font-medium">{displayedProfiles.length} profile{displayedProfiles.length !== 1 ? 's' : ''}</p>
          {!isPaidUser && (
            <div className="flex items-center gap-2 text-[18px]">
              <Eye size={18} />
              <span>{getRemainingViews()} views left today</span>
            </div>
          )}
        </div>

        {/* Profile Grid - Mobile */}
        {displayedProfiles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg text-muted-foreground">
              {profiles.length === 0 ? "No profiles available yet" : "No profiles match your search criteria"}
            </p>
          </div>
        ) : (
          <section className="space-y-4">
            {displayedProfiles.map((profile) => (
              <ProfileCardMobile
                key={profile.id}
                profile={profile}
                onView={handleViewProfile}
              />
            ))}

            {SHOW_UPGRADE_UI && !isPaidUser && filteredProfiles.length > MAX_FREE_VIEWS && (
              <div className="rounded-[24px] border border-brand-100 bg-white p-4 text-center shadow-soft">
                <Lock className="mx-auto h-6 w-6 text-brand-500" />
                <p className="mt-2 font-semibold text-brand-700">
                  {filteredProfiles.length - MAX_FREE_VIEWS} more profiles available
                </p>
                <Button
                  onClick={() => navigate('/plans')}
                  className="mt-3 w-full bg-gradient-to-r from-pink-500 to-purple-500"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Unlock All Profiles
                </Button>
              </div>
            )}
          </section>
        )}
      </main>

      <MobileBottomNav />

      {/* View Dialog */}
      <ClientProfileViewDialog
        profile={selectedProfile}
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
      />

      {/* Limit Reached Dialog - Mobile */}
      {SHOW_UPGRADE_UI && (
        <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
          <DialogContent className="mx-4 max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <Lock className="h-5 w-5" />
                Daily View Limit Reached
              </DialogTitle>
              <DialogDescription className="text-left">
                You've reached your daily limit of {MAX_FREE_VIEWS} profile views. 
                Upgrade to a premium plan for unlimited profile views and advanced search filters.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setLimitDialogOpen(false)}
                className="flex-1 rounded-xl"
              >
                Maybe Later
              </Button>
              <Button 
                onClick={() => {
                  setLimitDialogOpen(false);
                  navigate('/plans');
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500"
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  // Desktop Layout (>= 768px)
  const DesktopLayout = () => (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
      <ClientHeader
        showUpgradeButton={SHOW_UPGRADE_UI}
        showNotificationBell
        onSignOut={handleSignOut}
      />

      <div className="container mx-auto px-4 py-6">
        {/* Dashboard Header - Desktop */}
        <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-pink-100 shadow-sm px-6 py-4 mb-6">
          <h2 className="text-2xl font-semibold text-pink-700">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Browse matching profiles and manage your activity</p>
        </div>

        {/* View Limit Banner - Desktop */}
        <ViewLimitBanner 
          remainingViews={getRemainingViews()} 
          maxViews={MAX_FREE_VIEWS}
          isPaidUser={isPaidUser}
        />

        {/* Advanced Filters - Desktop */}
        <AdvancedSearchFilters 
          isPaidUser={isPaidUser}
          onFiltersChange={setFilters}
          onUpgradeClick={() => navigate('/plans')}
        />

        {/* Results count - Desktop */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {displayedProfiles.length} profile{displayedProfiles.length !== 1 ? 's' : ''}
            {!isPaidUser && filteredProfiles.length > MAX_FREE_VIEWS && (
              <span className="text-pink-600 ml-2">
                ({filteredProfiles.length - MAX_FREE_VIEWS} more with premium)
              </span>
            )}
          </p>
          {!isPaidUser && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>{getRemainingViews()} views left today</span>
            </div>
          )}
        </div>

        {/* Profile Grid - Desktop */}
        {displayedProfiles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg text-muted-foreground">
              {profiles.length === 0 ? "No profiles available yet" : "No profiles match your search criteria"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedProfiles.map((profile) => (
                <ClientProfileCard
                  key={profile.id}
                  profile={profile}
                  onView={handleViewProfile}
                />
              ))}
            </div>

            {SHOW_UPGRADE_UI && !isPaidUser && filteredProfiles.length > MAX_FREE_VIEWS && (
              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 px-6 py-4 rounded-lg border border-purple-200">
                  <Lock className="h-5 w-5 text-purple-600" />
                  <span className="text-purple-700 font-medium">
                    {filteredProfiles.length - MAX_FREE_VIEWS} more profiles available
                  </span>
                  <Button 
                    onClick={() => navigate('/plans')}
                    className="ml-2 bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    Unlock All
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* View Dialog */}
      <ClientProfileViewDialog
        profile={selectedProfile}
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
      />

      {/* Limit Reached Dialog - Desktop */}
      {SHOW_UPGRADE_UI && (
        <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <Lock className="h-5 w-5" />
                Daily View Limit Reached
              </DialogTitle>
              <DialogDescription className="text-left">
                You've reached your daily limit of {MAX_FREE_VIEWS} profile views. 
                Upgrade to a premium plan for unlimited profile views and advanced search filters.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setLimitDialogOpen(false)}
                className="flex-1"
              >
                Maybe Later
              </Button>
              <Button 
                onClick={() => {
                  setLimitDialogOpen(false);
                  navigate('/plans');
                }}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Now
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  return (
    <>
      <div className="md:hidden">
        <MobileLayout />
      </div>
      <div className="hidden md:block">
        <DesktopLayout />
      </div>
    </>
  );
};

export default Browse;
