import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export const useReactions = (messageIds: string[]) => {
  const [reactions, setReactions] = useState<Map<string, Reaction[]>>(new Map());
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

  const fetchReactions = useCallback(async () => {
    if (messageIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);

      if (error) throw error;

      const reactionMap = new Map<string, Reaction[]>();
      data?.forEach((reaction) => {
        const existing = reactionMap.get(reaction.message_id) || [];
        reactionMap.set(reaction.message_id, [...existing, reaction]);
      });

      setReactions(reactionMap);
    } catch (error) {
      console.error('Error fetching reactions:', error);
    }
  }, [messageIds]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  useEffect(() => {
    if (messageIds.length === 0) return;

    const channel = supabase
      .channel('reaction-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions'
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageIds, fetchReactions]);

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji
        });

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation - remove reaction instead
          await removeReaction(messageId, emoji);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
      toast.error('Failed to add reaction');
    }
  }, [currentUserId]);

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing reaction:', error);
      toast.error('Failed to remove reaction');
    }
  }, [currentUserId]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    const messageReactions = reactions.get(messageId) || [];
    const existingReaction = messageReactions.find(
      r => r.user_id === currentUserId && r.emoji === emoji
    );

    if (existingReaction) {
      await removeReaction(messageId, emoji);
    } else {
      await addReaction(messageId, emoji);
    }
  }, [reactions, currentUserId, addReaction, removeReaction]);

  return {
    reactions,
    currentUserId,
    toggleReaction
  };
};
