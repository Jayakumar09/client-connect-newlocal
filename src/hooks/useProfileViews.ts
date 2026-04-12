import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useProfileViews = () => {
  const [todayViewCount, setTodayViewCount] = useState(0);
  const [viewedProfileIds, setViewedProfileIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isPaidUser, setIsPaidUser] = useState(false);
  const [loading, setLoading] = useState(true);

  const MAX_FREE_VIEWS = 10;

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        await checkPaidStatus(user.id);
      }
      setLoading(false);
    };
    getCurrentUser();
  }, []);

  const checkPaidStatus = async (userId: string) => {
    try {
      // Check if user has an active paid subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_type, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (subscription && subscription.plan_type !== 'free') {
        setIsPaidUser(true);
        return;
      }

      // Also check payment_status in client_profiles
      const { data: profile } = await supabase
        .from('client_profiles')
        .select('payment_status')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile?.payment_status === 'paid') {
        setIsPaidUser(true);
      }
    } catch (error) {
      console.error('Error checking paid status:', error);
    }
  };

  const fetchTodayViews = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('profile_views')
        .select('viewed_profile_id')
        .eq('viewer_id', currentUserId)
        .eq('viewed_at', today);

      if (error) throw error;

      setTodayViewCount(data?.length || 0);
      setViewedProfileIds(new Set(data?.map(v => v.viewed_profile_id) || []));
    } catch (error) {
      console.error('Error fetching today views:', error);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchTodayViews();
  }, [fetchTodayViews]);

  const recordProfileView = useCallback(async (profileId: string) => {
    if (!currentUserId || currentUserId === profileId) return true;

    // Already viewed today
    if (viewedProfileIds.has(profileId)) return true;

    // Paid users have unlimited views
    if (isPaidUser) {
      try {
        await supabase
          .from('profile_views')
          .upsert({
            viewer_id: currentUserId,
            viewed_profile_id: profileId,
            viewed_at: new Date().toISOString().split('T')[0]
          }, {
            onConflict: 'viewer_id,viewed_profile_id,viewed_at'
          });
        
        setViewedProfileIds(prev => new Set([...prev, profileId]));
        setTodayViewCount(prev => prev + 1);
        return true;
      } catch (error) {
        console.error('Error recording view:', error);
        return true; // Don't block viewing on error
      }
    }

    // Check if free user has reached limit
    if (todayViewCount >= MAX_FREE_VIEWS) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('profile_views')
        .insert({
          viewer_id: currentUserId,
          viewed_profile_id: profileId,
          viewed_at: new Date().toISOString().split('T')[0]
        });

      if (error && error.code !== '23505') {
        throw error;
      }

      setViewedProfileIds(prev => new Set([...prev, profileId]));
      setTodayViewCount(prev => prev + 1);
      return true;
    } catch (error) {
      console.error('Error recording view:', error);
      return true;
    }
  }, [currentUserId, isPaidUser, todayViewCount, viewedProfileIds]);

  const canViewProfile = useCallback((profileId: string) => {
    if (isPaidUser) return true;
    if (viewedProfileIds.has(profileId)) return true;
    if (currentUserId === profileId) return true;
    return todayViewCount < MAX_FREE_VIEWS;
  }, [isPaidUser, viewedProfileIds, todayViewCount, currentUserId]);

  const getRemainingViews = useCallback(() => {
    if (isPaidUser) return Infinity;
    return Math.max(0, MAX_FREE_VIEWS - todayViewCount);
  }, [isPaidUser, todayViewCount]);

  return {
    todayViewCount,
    viewedProfileIds,
    isPaidUser,
    loading,
    recordProfileView,
    canViewProfile,
    getRemainingViews,
    MAX_FREE_VIEWS,
    fetchTodayViews
  };
};
