import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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
  deleted_at: string | null;
  archived_at: string | null;
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

export interface ChatAttachment {
  message_id: string;
  file: Buffer;
  file_name: string;
  mime_type: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = [
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

export class ChatService {
  private supabase: SupabaseClient | null = null;

  private getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
      }
      this.supabase = createClient(url, key);
    }
    return this.supabase;
  }

  validateAttachment(file: Express.Multer.File): { valid: boolean; error?: string } {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return { valid: false, error: 'File type not allowed' };
    }

    return { valid: true };
  }

  getMessageType(mimeType: string): 'text' | 'image' | 'video' | 'audio' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  async getConversations(userId: string): Promise<ChatConversation[]> {
    const supabase = this.getSupabaseClient();

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('is_archived', false)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const partnerIds = new Set<string>();
    messages?.forEach(msg => {
      if (msg.sender_id === userId) {
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

    messages?.forEach(msg => {
      const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      const profile = profileMap.get(partnerId);
      const presence = presenceMap.get(partnerId);

      if (!conversationMap.has(partnerId)) {
        const unreadCount = messages.filter(
          m => m.sender_id === partnerId &&
          m.receiver_id === userId &&
          !m.is_read &&
          !m.is_deleted
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

    return Array.from(conversationMap.values());
  }

  async getMessages(userId: string, partnerId: string, limit = 50, before?: string): Promise<ChatMessage[]> {
    const supabase = this.getSupabaseClient();

    let query = supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`)
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Mark messages as delivered
    await supabase
      .from('messages')
      .update({ delivery_status: 'delivered' })
      .eq('sender_id', partnerId)
      .eq('receiver_id', userId)
      .eq('delivery_status', 'sent');

    return (data || []) as ChatMessage[];
  }

  async sendMessage(
    senderId: string,
    receiverId: string,
    message: string,
    attachment?: {
      file: Buffer;
      file_name: string;
      mime_type: string;
      size: number;
    }
  ): Promise<ChatMessage> {
    const supabase = this.getSupabaseClient();

    let attachmentUrl = null;
    let attachmentName = null;
    let attachmentSize = null;
    let attachmentMimeType = null;
    let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text';

    if (attachment) {
      const fileId = uuidv4();
      const ext = attachment.file_name.split('.').pop();
      const storagePath = `${senderId}/${fileId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(storagePath, attachment.file, {
          contentType: attachment.mime_type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(storagePath);

      attachmentUrl = urlData.publicUrl;
      attachmentName = attachment.file_name;
      attachmentSize = attachment.size;
      attachmentMimeType = attachment.mime_type;
      messageType = this.getMessageType(attachment.mime_type);
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        message,
        message_type: messageType,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        attachment_size: attachmentSize,
        attachment_mime_type: attachmentMimeType,
        delivery_status: 'sent'
      })
      .select()
      .single();

    if (error) throw error;

    return data as ChatMessage;
  }

  async markAsRead(userId: string, partnerId: string): Promise<void> {
    const supabase = this.getSupabaseClient();

    await supabase
      .from('messages')
      .update({ is_read: true, delivery_status: 'read' })
      .eq('sender_id', partnerId)
      .eq('receiver_id', userId)
      .eq('is_read', false);
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const supabase = this.getSupabaseClient();

    await supabase
      .from('messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        message: '[Message deleted]',
        attachment_url: null
      })
      .eq('id', messageId)
      .eq('sender_id', userId);
  }

  async archiveConversation(userId: string, partnerId: string): Promise<void> {
    const supabase = this.getSupabaseClient();

    const lastMessage = await supabase
      .from('messages')
      .select('id, message')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    await supabase
      .from('archived_conversations')
      .upsert({
        user_id: userId,
        partner_id: partnerId,
        last_message_id: lastMessage.data?.id,
        last_message_preview: lastMessage.data?.message
      }, { onConflict: 'user_id,partner_id' });

    await supabase
      .from('messages')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`);
  }

  async unarchiveConversation(userId: string, partnerId: string): Promise<void> {
    const supabase = this.getSupabaseClient();

    await supabase
      .from('archived_conversations')
      .delete()
      .eq('user_id', userId)
      .eq('partner_id', partnerId);

    await supabase
      .from('messages')
      .update({ is_archived: false, archived_at: null })
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`);
  }

  async getArchivedConversations(userId: string): Promise<ChatConversation[]> {
    const supabase = this.getSupabaseClient();

    const { data: archives } = await supabase
      .from('archived_conversations')
      .select('partner_id, archived_at, last_message_preview')
      .eq('user_id', userId)
      .order('archived_at', { ascending: false });

    const conversations: ChatConversation[] = [];

    for (const archive of archives || []) {
      const { data: profile } = await supabase
        .from('client_profiles')
        .select('full_name, profile_photo')
        .eq('user_id', archive.partner_id)
        .single();

      conversations.push({
        partnerId: archive.partner_id,
        partnerName: profile?.full_name || 'Unknown User',
        partnerPhoto: profile?.profile_photo || null,
        lastMessage: archive.last_message_preview || '',
        lastMessageTime: archive.archived_at,
        unreadCount: 0,
        isOnline: false,
        lastSeenAt: null
      });
    }

    return conversations;
  }

  async searchMessages(userId: string, searchQuery: string, limit = 20): Promise<ChatMessage[]> {
    const supabase = this.getSupabaseClient();

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('is_deleted', false)
      .ilike('message', `%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []) as ChatMessage[];
  }

  async updatePresence(userId: string, isOnline: boolean): Promise<void> {
    const supabase = this.getSupabaseClient();

    await supabase
      .from('conversation_presences')
      .upsert({
        user_id: userId,
        is_online: isOnline,
        last_seen_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
  }

  async getTotalUnreadCount(userId: string): Promise<number> {
    const supabase = this.getSupabaseClient();

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .eq('is_deleted', false);

    if (error) throw error;

    return count || 0;
  }
}

export const chatService = new ChatService();