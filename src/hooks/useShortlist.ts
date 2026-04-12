import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ShortlistedProfile {
  id: string;
  user_id: string;
  shortlisted_user_id: string;
  created_at: string;
}

export const useShortlist = () => {
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
  const [shortlistedProfiles, setShortlistedProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const fetchShortlist = useCallback(async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profile_shortlists')
        .select('*')
        .eq('user_id', currentUserId);

      if (error) throw error;

      const ids = new Set<string>(data?.map(s => s.shortlisted_user_id as string) || []);
      setShortlistedIds(ids);

      // Fetch full profiles for shortlisted users
      if (ids.size > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('client_profiles')
          .select('*')
          .in('user_id', Array.from(ids));

        if (profileError) throw profileError;
        setShortlistedProfiles(profiles || []);
      } else {
        setShortlistedProfiles([]);
      }
    } catch (error) {
      console.error('Error fetching shortlist:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchShortlist();
  }, [fetchShortlist]);

  const addToShortlist = useCallback(async (profileUserId: string) => {
    if (!currentUserId) {
      toast.error('Please login to shortlist profiles');
      return false;
    }

    if (profileUserId === currentUserId) {
      toast.error("You can't shortlist your own profile");
      return false;
    }

    try {
      const { error } = await supabase
        .from('profile_shortlists')
        .insert({
          user_id: currentUserId,
          shortlisted_user_id: profileUserId
        });

      if (error) {
        if (error.code === '23505') {
          toast.info('Profile is already in your shortlist');
        } else {
          throw error;
        }
      } else {
        toast.success('Added to shortlist');
        await fetchShortlist();
      }
      return true;
    } catch (error) {
      console.error('Error adding to shortlist:', error);
      toast.error('Failed to add to shortlist');
      return false;
    }
  }, [currentUserId, fetchShortlist]);

  const removeFromShortlist = useCallback(async (profileUserId: string) => {
    if (!currentUserId) return false;

    try {
      const { error } = await supabase
        .from('profile_shortlists')
        .delete()
        .eq('user_id', currentUserId)
        .eq('shortlisted_user_id', profileUserId);

      if (error) throw error;

      toast.success('Removed from shortlist');
      await fetchShortlist();
      return true;
    } catch (error) {
      console.error('Error removing from shortlist:', error);
      toast.error('Failed to remove from shortlist');
      return false;
    }
  }, [currentUserId, fetchShortlist]);

  const toggleShortlist = useCallback(async (profileUserId: string) => {
    if (shortlistedIds.has(profileUserId)) {
      return await removeFromShortlist(profileUserId);
    } else {
      return await addToShortlist(profileUserId);
    }
  }, [shortlistedIds, addToShortlist, removeFromShortlist]);

  const isShortlisted = useCallback((profileUserId: string) => {
    return shortlistedIds.has(profileUserId);
  }, [shortlistedIds]);

  return {
    shortlistedIds,
    shortlistedProfiles,
    loading,
    addToShortlist,
    removeFromShortlist,
    toggleShortlist,
    isShortlisted,
    fetchShortlist
  };
};
