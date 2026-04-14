-- ==============================================================================
-- Messages Table Attachment Columns Migration
-- Run this SQL in Supabase SQL Editor
-- IMPORTANT: After running, go to Supabase Dashboard → Database → Schema Diagrams → Refresh
-- ==============================================================================

-- Add missing columns one by one for better error handling
DO $$
BEGIN
  -- Core attachment columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_url') THEN
    ALTER TABLE messages ADD COLUMN attachment_url TEXT;
    RAISE NOTICE 'Added column: attachment_url';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_name') THEN
    ALTER TABLE messages ADD COLUMN attachment_name TEXT;
    RAISE NOTICE 'Added column: attachment_name';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_size') THEN
    ALTER TABLE messages ADD COLUMN attachment_size BIGINT;
    RAISE NOTICE 'Added column: attachment_size';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_mime_type') THEN
    ALTER TABLE messages ADD COLUMN attachment_mime_type TEXT;
    RAISE NOTICE 'Added column: attachment_mime_type';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') THEN
    ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text';
    RAISE NOTICE 'Added column: message_type';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'delivery_status') THEN
    ALTER TABLE messages ADD COLUMN delivery_status TEXT DEFAULT 'sent';
    RAISE NOTICE 'Added column: delivery_status';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_read') THEN
    ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added column: is_read';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_deleted') THEN
    ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added column: is_deleted';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_archived') THEN
    ALTER TABLE messages ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added column: is_archived';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'deleted_at') THEN
    ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMPTZ;
    RAISE NOTICE 'Added column: deleted_at';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'archived_at') THEN
    ALTER TABLE messages ADD COLUMN archived_at TIMESTAMPTZ;
    RAISE NOTICE 'Added column: archived_at';
  END IF;

  RAISE NOTICE 'All columns added successfully';
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ==============================================================================
-- Verification - Run this to see current columns
-- ==============================================================================
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages' ORDER BY column_name;
