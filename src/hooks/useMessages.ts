import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerPhoto: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export const useMessages = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
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

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;
    
    setLoading(true);
    try {
      // Get all messages where user is sender or receiver
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique conversation partners
      const partnerIds = new Set<string>();
      messagesData?.forEach(msg => {
        if (msg.sender_id === currentUserId) {
          partnerIds.add(msg.receiver_id);
        } else {
          partnerIds.add(msg.sender_id);
        }
      });

      // Fetch partner profiles
      const { data: profiles } = await supabase
        .from('client_profiles')
        .select('user_id, full_name, profile_photo')
        .in('user_id', Array.from(partnerIds));

      const profileMap = new Map<string, { user_id: string; full_name: string; profile_photo: string | null }>(
        profiles?.map(p => [p.user_id, p]) || []
      );

      // Build conversations list
      const conversationMap = new Map<string, Conversation>();
      
      messagesData?.forEach(msg => {
        const partnerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
        const profile = profileMap.get(partnerId);
        
        if (!conversationMap.has(partnerId)) {
          const unreadCount = messagesData.filter(
            m => m.sender_id === partnerId && 
            m.receiver_id === currentUserId && 
            !m.is_read
          ).length;

          conversationMap.set(partnerId, {
            partnerId,
            partnerName: profile?.full_name || 'Unknown User',
            partnerPhoto: profile?.profile_photo || null,
            lastMessage: msg.message,
            lastMessageTime: msg.created_at,
            unreadCount
          });
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const fetchMessages = useCallback(async (partnerId: string) => {
    if (!currentUserId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', partnerId)
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);

    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const sendMessage = useCallback(async (receiverId: string, messageText: string) => {
    if (!currentUserId) return null;
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: receiverId,
          message: messageText
        })
        .select()
        .single();

      if (error) throw error;
      
      // Add to local state immediately
      setMessages(prev => [...prev, data]);
      
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      return null;
    }
  }, [currentUserId]);

  const subscribeToMessages = useCallback((partnerId: string) => {
    if (!currentUserId) return () => {};

    const channel = supabase
      .channel(`messages:${currentUserId}:${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId}))`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const getUnreadCount = useCallback(async () => {
    if (!currentUserId) return 0;
    
    try {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);
      
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }, [currentUserId]);

  return {
    conversations,
    messages,
    loading,
    currentUserId,
    fetchConversations,
    fetchMessages,
    sendMessage,
    subscribeToMessages,
    getUnreadCount
  };
};
