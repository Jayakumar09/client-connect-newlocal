import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useBlockReport = () => {
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
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

  const fetchBlockedUsers = useCallback(async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', currentUserId);

      if (error) throw error;

      setBlockedIds(new Set(data?.map(b => b.blocked_id) || []));
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const blockUser = useCallback(async (userId: string) => {
    if (!currentUserId) {
      toast.error('Please login to block users');
      return false;
    }

    if (userId === currentUserId) {
      toast.error("You can't block yourself");
      return false;
    }

    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: currentUserId,
          blocked_id: userId
        });

      if (error) {
        if (error.code === '23505') {
          toast.info('User is already blocked');
        } else {
          throw error;
        }
      } else {
        toast.success('User blocked successfully');
        await fetchBlockedUsers();
      }
      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
      return false;
    }
  }, [currentUserId, fetchBlockedUsers]);

  const unblockUser = useCallback(async (userId: string) => {
    if (!currentUserId) return false;

    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', userId);

      if (error) throw error;

      toast.success('User unblocked');
      await fetchBlockedUsers();
      return true;
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user');
      return false;
    }
  }, [currentUserId, fetchBlockedUsers]);

  const reportUser = useCallback(async (userId: string, reason: string, description?: string) => {
    if (!currentUserId) {
      toast.error('Please login to report users');
      return false;
    }

    if (userId === currentUserId) {
      toast.error("You can't report yourself");
      return false;
    }

    try {
      const { error } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: currentUserId,
          reported_user_id: userId,
          reason,
          description: description || null
        });

      if (error) throw error;

      toast.success('Report submitted. Our team will review it.');
      return true;
    } catch (error) {
      console.error('Error reporting user:', error);
      toast.error('Failed to submit report');
      return false;
    }
  }, [currentUserId]);

  const isBlocked = useCallback((userId: string) => {
    return blockedIds.has(userId);
  }, [blockedIds]);

  return {
    blockedIds,
    loading,
    blockUser,
    unblockUser,
    reportUser,
    isBlocked,
    fetchBlockedUsers
  };
};
