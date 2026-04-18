import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document';
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_mime_type: string | null;
  is_read: boolean;
  is_deleted: boolean;
  is_archived: boolean;
  delivery_status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ChatConversation {
  partnerId: string;
  partnerName: string;
  partnerPhoto: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  lastSeenAt: string | null;
}

export interface AttachmentFile {
  file: File;
  preview?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
];

export const useChat = () => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searching, setSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'File type not allowed' };
    }
    return { valid: true };
  }, []);

  const getFilePreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        resolve('');
      }
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;
    
    setLoading(true);
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .eq('is_archived', false)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const partnerIds = new Set<string>();
      messagesData?.forEach(msg => {
        if (msg.sender_id === currentUserId) {
          partnerIds.add(msg.receiver_id);
        } else {
          partnerIds.add(msg.sender_id);
        }
      });

      const { data: profiles } = await supabase
        .from('client_profiles')
        .select('user_id, full_name, profile_photo')
        .in('user_id', Array.from(partnerIds));

      const profileMap = new Map<string, { user_id: string; full_name: string; profile_photo: string | null }>(
        profiles?.map(p => [p.user_id, p]) || []
      );

      const { data: presences } = await supabase
        .from('conversation_presences')
        .select('user_id, is_online, last_seen_at')
        .in('user_id', Array.from(partnerIds));

      const presenceMap = new Map<string, { is_online: boolean; last_seen_at: string }>(
        presences?.map(p => [p.user_id, { is_online: p.is_online, last_seen_at: p.last_seen_at }]) || []
      );

      const conversationMap = new Map<string, ChatConversation>();
      
      messagesData?.forEach(msg => {
        const partnerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
        const profile = profileMap.get(partnerId);
        const presence = presenceMap.get(partnerId);
        
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
            unreadCount,
            isOnline: presence?.is_online || false,
            lastSeenAt: presence?.last_seen_at || null
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

  const fetchMessages = useCallback(async (partnerId: string, limit = 50) => {
    if (!currentUserId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      setMessages(data || []);

      await supabase
        .from('messages')
        .update({ is_read: true, delivery_status: 'read' })
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
          message: messageText,
          message_type: 'text',
          delivery_status: 'sent'
        })
        .select()
        .single();

      if (error) throw error;
      
      setMessages(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      return null;
    }
  }, [currentUserId]);

  const sendAttachment = useCallback(async (receiverId: string, file: File, messageText = '') => {
    if (!currentUserId) return null;
    
    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return null;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentUserId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'document';
      if (file.type.startsWith('image/')) messageType = 'image';
      else if (file.type.startsWith('video/')) messageType = 'video';
      else if (file.type.startsWith('audio/')) messageType = 'audio';

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: receiverId,
          message: messageText,
          message_type: messageType,
          attachment_url: urlData.publicUrl,
          attachment_name: file.name,
          attachment_size: file.size,
          attachment_mime_type: file.type,
          delivery_status: 'sent'
        })
        .select()
        .single();

      if (error) throw error;
      
      setMessages(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      toast.error('Failed to upload attachment');
      return null;
    }
  }, [currentUserId, validateFile]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!currentUserId) return false;
    
    try {
      await supabase
        .from('messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          message: '[Message deleted]',
          attachment_url: null
        })
        .eq('id', messageId)
        .eq('sender_id', currentUserId);

      setMessages(prev => prev.filter(m => m.id !== messageId));
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
      return false;
    }
  }, [currentUserId]);

  const archiveConversation = useCallback(async (partnerId: string) => {
    if (!currentUserId) return false;
    
    try {
      const lastMessage = await supabase
        .from('messages')
        .select('id, message')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      await supabase
        .from('archived_conversations')
        .upsert({
          user_id: currentUserId,
          partner_id: partnerId,
          last_message_id: lastMessage.data?.id,
          last_message_preview: lastMessage.data?.message
        }, { onConflict: 'user_id,partner_id' });

      await supabase
        .from('messages')
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`);

      setConversations(prev => prev.filter(c => c.partnerId !== partnerId));
      return true;
    } catch (error) {
      console.error('Error archiving conversation:', error);
      toast.error('Failed to archive conversation');
      return false;
    }
  }, [currentUserId]);

  const unarchiveConversation = useCallback(async (partnerId: string) => {
    if (!currentUserId) return false;
    
    try {
      await supabase
        .from('archived_conversations')
        .delete()
        .eq('user_id', currentUserId)
        .eq('partner_id', partnerId);

      await supabase
        .from('messages')
        .update({ is_archived: false, archived_at: null })
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`);

      await fetchConversations();
      return true;
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
      toast.error('Failed to unarchive conversation');
      return false;
    }
  }, [currentUserId, fetchConversations]);

  const searchMessages = useCallback(async (query: string) => {
    if (!currentUserId || !query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .eq('is_deleted', false)
        .ilike('message', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching messages:', error);
      toast.error('Failed to search messages');
    } finally {
      setSearching(false);
    }
  }, [currentUserId]);

  const subscribeToMessages = useCallback((partnerId: string) => {
    if (!currentUserId) return () => {};

    const channelName = `chat:${currentUserId}:${partnerId}`;

    // Remove any existing channel with the same topic to avoid adding handlers after subscribe
    const existing = supabase.getChannels().find(c => c.topic === channelName);
    if (existing) supabase.removeChannel(existing);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId}))`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages(prev => {
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

  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!currentUserId) return;

    try {
      await supabase
        .from('conversation_presences')
        .upsert({
          user_id: currentUserId,
          is_online: isOnline,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [currentUserId]);

  const getUnreadCount = useCallback(async () => {
    if (!currentUserId) return 0;
    
    try {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', currentUserId)
        .eq('is_read', false)
        .eq('is_deleted', false);
      
      setUnreadTotal(count || 0);
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
    unreadTotal,
    searchResults,
    searching,
    fetchConversations,
    fetchMessages,
    sendMessage,
    sendAttachment,
    deleteMessage,
    archiveConversation,
    unarchiveConversation,
    searchMessages,
    subscribeToMessages,
    updatePresence,
    getUnreadCount,
    validateFile,
    getFilePreview,
    fileInputRef
  };
};