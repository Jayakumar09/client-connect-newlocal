import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Crown, Heart, Eye, Lock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import ClientProfileCard from "@/components/ClientProfileCard";
import ClientProfileViewDialog from "@/components/ClientProfileViewDialog";
import { NotificationBell } from "@/components/NotificationBell";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import AdvancedSearchFilters, { SearchFilters } from "@/components/AdvancedSearchFilters";
import ViewLimitBanner from "@/components/ViewLimitBanner";
import { useProfileViews } from "@/hooks/useProfileViews";
import { ClientHeader } from "@/components/ClientHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ClientProfile = Tables<"client_profiles"> & {
  match_status?: 'not_matched' | 'matched' | null;
  matched_with_id?: string | null;
  match_remarks?: string | null;
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

    // Search term filter
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

    // Gender filter
    if (filters.gender !== "all") {
      filtered = filtered.filter(p => p.gender === filters.gender);
    }

    // Religion filter
    if (filters.religion !== "all") {
      filtered = filtered.filter(p => p.religion === filters.religion);
    }

    // Marital status filter
    if (filters.maritalStatus !== "all") {
      filtered = filtered.filter(p => p.marital_status === filters.maritalStatus);
    }

    // Age range filter
    if (filters.ageMin || filters.ageMax) {
      filtered = filtered.filter(p => {
        const age = calculateAge(p.date_of_birth);
        const minAge = filters.ageMin ? parseInt(filters.ageMin) : 0;
        const maxAge = filters.ageMax ? parseInt(filters.ageMax) : 999;
        return age >= minAge && age <= maxAge;
      });
    }

    // Premium filters (only for paid users)
    if (isPaidUser) {
      // Caste filter
      if (filters.caste && filters.caste !== 'all') {
        filtered = filtered.filter(p => 
          p.caste?.toLowerCase().includes(filters.caste.toLowerCase())
        );
      }

      // City filter
      if (filters.city) {
        filtered = filtered.filter(p => 
          p.city?.toLowerCase().includes(filters.city.toLowerCase())
        );
      }

      // Education filter
      if (filters.education && filters.education !== 'all') {
        filtered = filtered.filter(p => 
          p.education?.toLowerCase().includes(filters.education.toLowerCase())
        );
      }

      // Income filter
      if (filters.income && filters.income !== 'all') {
        filtered = filtered.filter(p => 
          p.annual_income?.toLowerCase().includes(filters.income.toLowerCase())
        );
      }
    }

    return filtered;
  }, [profiles, filters, currentUserId, isPaidUser]);

  // For non-paid users, limit visible profiles to first 10
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
    // Check if user can view this profile
    if (!canViewProfile(profile.user_id)) {
      setLimitDialogOpen(true);
      return;
    }

    // Record the view
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
      <ClientHeader
        showUpgradeButton={SHOW_UPGRADE_UI}
        showNotificationBell
        onSignOut={handleSignOut}
      />

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 pb-24 md:pb-6">
        {/* Dashboard Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-pink-100 shadow-sm px-3 sm:px-6 py-3 sm:py-4 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-pink-700">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Browse matching profiles and manage your activity</p>
        </div>

        {/* View Limit Banner */}
        <ViewLimitBanner 
          remainingViews={getRemainingViews()} 
          maxViews={MAX_FREE_VIEWS}
          isPaidUser={isPaidUser}
        />

        {/* Advanced Filters */}
        <AdvancedSearchFilters 
          isPaidUser={isPaidUser}
          onFiltersChange={setFilters}
          onUpgradeClick={() => navigate('/plans')}
        />

        {/* Results count */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 sm:mb-4">
          <p className="text-sm text-muted-foreground">
            {displayedProfiles.length} profile{displayedProfiles.length !== 1 ? 's' : ''}
            {!isPaidUser && filteredProfiles.length > MAX_FREE_VIEWS && (
              <span className="text-pink-600 ml-1 sm:ml-2">
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

        {/* Profile Grid */}
        {displayedProfiles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg text-muted-foreground">
              {profiles.length === 0 ? "No profiles available yet" : "No profiles match your search criteria"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {displayedProfiles.map((profile) => (
                <ClientProfileCard
                  key={profile.id}
                  profile={profile}
                  onView={handleViewProfile}
                />
              ))}
            </div>

            {/* Show locked profiles indicator for free users */}
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

{/* Limit Reached Dialog - only show if upgrade UI is enabled */}
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
        <MobileBottomNav />
    </div>
  );
};

export default Browse;
