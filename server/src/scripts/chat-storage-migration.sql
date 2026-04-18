-- ==============================================================================
-- Chat Storage Bucket Migration - FIXED RLS POLICIES
-- Run this SQL in Supabase SQL Editor to create/fix chat attachments storage bucket
-- ==============================================================================

-- Create the chat-attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  52428800, -- 50MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- FIXED RLS POLICIES
-- The key fix: Use auth.uid() properly with the correct foldername extraction
-- ==============================================================================

-- Drop ALL existing policies for chat-attachments bucket
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage chat attachments" ON storage.objects;

-- Policy 1: Allow anyone to view/read attachments from chat-attachments bucket
-- This is needed because clients need to see attachments from admins
CREATE POLICY "chat_attachments_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-attachments');

-- Policy 2: Allow authenticated users to INSERT (upload) attachments
-- Path format expected: <auth.uid()>/<filename>
-- Example: 64b2abb4-87f5-4458-aff8-20cfc9d5dd88/1712345678901-document.pdf
CREATE POLICY "chat_attachments_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-attachments' 
    AND auth.role() = 'authenticated'
  );

-- Policy 3: Allow users to UPDATE their own attachments
CREATE POLICY "chat_attachments_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'chat-attachments'
  );

-- Policy 4: Allow users to DELETE their own attachments
-- Using foldername extraction: (storage.foldername(name))[1] gets the first folder
CREATE POLICY "chat_attachments_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-attachments'
  );

-- ==============================================================================
-- ENABLE RLS on storage.objects if not already enabled
-- ==============================================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- Verification queries (run these to check status)
-- ==============================================================================

-- Check if bucket exists
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'chat-attachments';

-- Check storage policies for this bucket
SELECT 
  policyname, 
  cmd, 
  qual, 
  with_check 
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%chat%';

-- Test foldername extraction (useful for debugging)
-- SELECT storage.foldername('64b2abb4-87f5-4458-aff8-20cfc9d5dd88/1712345678901-document.pdf');
-- Expected output: {64b2abb4-87f5-4458-aff8-20cfc9d5dd88,1712345678901-document.pdf}
