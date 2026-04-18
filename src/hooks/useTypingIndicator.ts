import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimePresenceState } from '@supabase/supabase-js';

interface TypingState {
  [partnerId: string]: boolean;
}

interface PresencePayload {
  user_id?: string;
  is_typing?: boolean;
  timestamp?: string;
}

export const useTypingIndicator = (currentUserId: string | null, partnerId: string) => {
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<ReturnType<typeof supabase.channel>>();

  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!currentUserId || !channelRef.current) return;

    channelRef.current.track({
      user_id: currentUserId,
      is_typing: isTyping,
      timestamp: new Date().toISOString()
    });
  }, [currentUserId]);

  const handleTyping = useCallback(() => {
    sendTypingStatus(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 2000);
  }, [sendTypingStatus]);

  useEffect(() => {
    if (!currentUserId || !partnerId) return;

    const roomId = [currentUserId, partnerId].sort().join(':');
    const channel = supabase.channel(`typing:${roomId}`);
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let partnerIsTyping = false;
        
        Object.values(state as RealtimePresenceState<PresencePayload>).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.user_id === partnerId && presence.is_typing) {
              partnerIsTyping = true;
            }
          });
        });
        
        setIsPartnerTyping(partnerIsTyping);
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [currentUserId, partnerId]);

  return {
    isPartnerTyping,
    handleTyping
  };
};
