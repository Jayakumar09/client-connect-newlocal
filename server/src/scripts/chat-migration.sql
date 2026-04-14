-- Chat System Database Migration
-- Run this SQL in your Supabase SQL Editor

-- 1. Add new columns to messages table for enhanced features
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document')),
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_size INTEGER,
ADD COLUMN IF NOT EXISTS attachment_mime_type TEXT,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sending', 'sent', 'delivered', 'read', 'failed'));

-- 2. Create conversation_presences table for online/offline status
CREATE TABLE IF NOT EXISTS conversation_presences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 3. Create chat_attachments table for storing attachment metadata
CREATE TABLE IF NOT EXISTS chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT DEFAULT 'chat-attachments',
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create archived_conversations table
CREATE TABLE IF NOT EXISTS archived_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_id UUID,
  last_message_preview TEXT,
  UNIQUE(user_id, partner_id)
);

-- 5. Create index for faster message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_lookup 
ON messages(sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_search 
ON messages USING gin(to_tsvector('english', message));

CREATE INDEX IF NOT EXISTS idx_messages_archived 
ON messages(is_archived, is_deleted) WHERE is_archived = TRUE OR is_deleted = TRUE;

CREATE INDEX IF NOT EXISTS idx_messages_delivery_status 
ON messages(delivery_status) WHERE delivery_status = 'delivered';

-- 6. Create function to handle message deletion (soft delete)
CREATE OR REPLACE FUNCTION delete_message(message_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages 
  SET is_deleted = TRUE, 
      deleted_at = NOW(),
      message = '[Message deleted]',
      attachment_url = NULL,
      message_type = 'text'
  WHERE id = message_id;
END;
$$;

-- 7. Create function to handle message archive
CREATE OR REPLACE FUNCTION archive_conversation(user_id UUID, partner_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO archived_conversations (user_id, partner_id, last_message_id, last_message_preview)
  VALUES (
    user_id, 
    partner_id,
    (SELECT id FROM messages WHERE (sender_id = user_id AND receiver_id = partner_id) OR (sender_id = partner_id AND receiver_id = user_id) ORDER BY created_at DESC LIMIT 1),
    (SELECT message FROM messages WHERE (sender_id = user_id AND receiver_id = partner_id) OR (sender_id = partner_id AND receiver_id = user_id) ORDER BY created_at DESC LIMIT 1)
  )
  ON CONFLICT (user_id, partner_id) 
  DO UPDATE SET archived_at = NOW();
  
  UPDATE messages
  SET is_archived = TRUE, archived_at = NOW()
  WHERE (sender_id = user_id AND receiver_id = partner_id) 
     OR (sender_id = partner_id AND receiver_id = user_id);
END;
$$;

-- 8. Create function to unarchive conversation
CREATE OR REPLACE FUNCTION unarchive_conversation(user_id UUID, partner_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM archived_conversations WHERE user_id = user_id AND partner_id = partner_id;
  
  UPDATE messages
  SET is_archived = FALSE, archived_at = NULL
  WHERE (sender_id = user_id AND receiver_id = partner_id) 
     OR (sender_id = partner_id AND receiver_id = user_id);
END;
$$;

-- 9. Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_presences ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies
-- Messages: users can only see their own messages
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can insert own messages" ON messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Chat attachments policies
CREATE POLICY "Users can view own attachments" ON chat_attachments
  FOR SELECT USING (uploaded_by = auth.uid());

CREATE POLICY "Users can insert own attachments" ON chat_attachments
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Archived conversations policies
CREATE POLICY "Users can view own archives" ON archived_conversations
  FOR SELECT USING (user_id = auth.uid());

-- Conversation presences policies  
CREATE POLICY "Users can manage own presence" ON conversation_presences
  FOR ALL USING (user_id = auth.uid());

-- 11. Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  52428800, -- 50MB limit
  ARRAY['image/*', 'video/*', 'audio/*', 'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- 12. Storage policies
CREATE POLICY "Anyone can view chat attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated users can upload chat attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own chat attachments" ON storage.objects
  FOR DELETE USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 13. Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_presence_updated_at
  BEFORE UPDATE ON conversation_presences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 14. Realtime subscription to messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_presences;
