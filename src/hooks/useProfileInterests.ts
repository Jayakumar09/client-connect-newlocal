import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProfileInterest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface InterestWithProfile extends ProfileInterest {
  profile?: {
    full_name: string;
    profile_photo: string | null;
    city: string | null;
    occupation: string | null;
  };
}

export const useProfileInterests = () => {
  const [sentInterests, setSentInterests] = useState<InterestWithProfile[]>([]);
  const [receivedInterests, setReceivedInterests] = useState<InterestWithProfile[]>([]);
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

  const fetchInterests = useCallback(async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      // Fetch sent interests
      const { data: sent, error: sentError } = await supabase
        .from('profile_interests')
        .select('*')
        .eq('sender_id', currentUserId)
        .order('created_at', { ascending: false });

      if (sentError) throw sentError;

      // Fetch received interests
      const { data: received, error: receivedError } = await supabase
        .from('profile_interests')
        .select('*')
        .eq('receiver_id', currentUserId)
        .order('created_at', { ascending: false });

      if (receivedError) throw receivedError;

      // Get profile details for sent interests
      if (sent && sent.length > 0) {
        const receiverIds = sent.map(i => i.receiver_id);
        const { data: profiles } = await supabase
          .from('client_profiles')
          .select('user_id, full_name, profile_photo, city, occupation')
          .in('user_id', receiverIds);

        const sentWithProfiles = sent.map(interest => ({
          ...interest,
          status: interest.status as 'pending' | 'accepted' | 'declined',
          profile: profiles?.find(p => p.user_id === interest.receiver_id)
        }));
        setSentInterests(sentWithProfiles);
      } else {
        setSentInterests([]);
      }

      // Get profile details for received interests
      if (received && received.length > 0) {
        const senderIds = received.map(i => i.sender_id);
        const { data: profiles } = await supabase
          .from('client_profiles')
          .select('user_id, full_name, profile_photo, city, occupation')
          .in('user_id', senderIds);

        const receivedWithProfiles = received.map(interest => ({
          ...interest,
          status: interest.status as 'pending' | 'accepted' | 'declined',
          profile: profiles?.find(p => p.user_id === interest.sender_id)
        }));
        setReceivedInterests(receivedWithProfiles);
      } else {
        setReceivedInterests([]);
      }
    } catch (error) {
      console.error('Error fetching interests:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('profile_interests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profile_interests',
        },
        () => {
          fetchInterests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchInterests]);

  const sendInterest = useCallback(async (receiverId: string, message?: string) => {
    if (!currentUserId) {
      toast.error('Please login to send interest');
      return false;
    }

    if (receiverId === currentUserId) {
      toast.error("You can't send interest to yourself");
      return false;
    }

    try {
      const { error } = await supabase
        .from('profile_interests')
        .insert({
          sender_id: currentUserId,
          receiver_id: receiverId,
          message: message || null
        });

      if (error) {
        if (error.code === '23505') {
          toast.info('Interest already sent to this profile');
        } else {
          throw error;
        }
      } else {
        toast.success('Interest sent successfully!');
        await fetchInterests();
      }
      return true;
    } catch (error) {
      console.error('Error sending interest:', error);
      toast.error('Failed to send interest');
      return false;
    }
  }, [currentUserId, fetchInterests]);

  const updateInterestStatus = useCallback(async (interestId: string, status: 'accepted' | 'declined') => {
    try {
      const { error } = await supabase
        .from('profile_interests')
        .update({ status })
        .eq('id', interestId);

      if (error) throw error;

      toast.success(`Interest ${status}!`);
      await fetchInterests();
      return true;
    } catch (error) {
      console.error('Error updating interest:', error);
      toast.error('Failed to update interest');
      return false;
    }
  }, [fetchInterests]);

  const cancelInterest = useCallback(async (receiverId: string) => {
    if (!currentUserId) return false;

    try {
      const { error } = await supabase
        .from('profile_interests')
        .delete()
        .eq('sender_id', currentUserId)
        .eq('receiver_id', receiverId);

      if (error) throw error;

      toast.success('Interest cancelled');
      await fetchInterests();
      return true;
    } catch (error) {
      console.error('Error cancelling interest:', error);
      toast.error('Failed to cancel interest');
      return false;
    }
  }, [currentUserId, fetchInterests]);

  const hasInterestSent = useCallback((receiverId: string) => {
    return sentInterests.some(i => i.receiver_id === receiverId);
  }, [sentInterests]);

  const getInterestStatus = useCallback((receiverId: string) => {
    const interest = sentInterests.find(i => i.receiver_id === receiverId);
    return interest?.status || null;
  }, [sentInterests]);

  return {
    sentInterests,
    receivedInterests,
    loading,
    sendInterest,
    updateInterestStatus,
    cancelInterest,
    hasInterestSent,
    getInterestStatus,
    fetchInterests
  };
};
