-- ==============================================================================
-- Chat Storage Setup - Alternative Methods
-- ==============================================================================

-- METHOD 1: If you have access to Supabase Dashboard (Recommended)
-- Go to: Storage → chat-attachments → Policies → Add Policy
-- Create these policies manually:
--
-- Policy 1 - For Reading (SELECT):
-- Name: "Allow public read"
-- Schema: storage
-- Command: SELECT
-- USING expression: bucket_id = 'chat-attachments'
--
-- Policy 2 - For Uploading (INSERT):
-- Name: "Allow authenticated upload"  
-- Schema: storage
-- Command: INSERT
-- WITH CHECK expression: bucket_id = 'chat-attachments'
--
-- Policy 3 - For Deleting (DELETE):
-- Name: "Allow authenticated delete"
-- Schema: storage
-- Command: DELETE
-- USING expression: bucket_id = 'chat-attachments'

-- ==============================================================================

-- METHOD 2: Using Supabase Service Role (if you have service_role key)
-- Run this via Supabase CLI or pgAdmin with service role:

-- First check current policies
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- ==============================================================================

-- METHOD 3: SQL Workaround using SECURITY DEFINER function
-- This bypasses RLS for storage operations

CREATE OR REPLACE FUNCTION setup_chat_storage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create bucket if not exists
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'chat-attachments',
    'chat-attachments',
    true,
    52428800,
    ARRAY[
      'image/jpeg','image/png','image/gif','image/webp',
      'video/mp4','video/webm','video/quicktime',
      'audio/mpeg','audio/wav','audio/ogg','audio/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ]
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create policies using direct SQL (requires elevated permissions)
  -- These will work if run by a superuser
  
  -- Drop existing chat policies
  DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;

  -- Create SELECT policy (anyone can view)
  CREATE POLICY "chat_attachments_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-attachments');

  -- Create INSERT policy (authenticated users can upload)
  CREATE POLICY "chat_attachments_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

  -- Create DELETE policy
  CREATE POLICY "chat_attachments_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'chat-attachments');

EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Insufficient privileges to create policies. Please use Supabase Dashboard Storage UI.';
END;
$$;

-- Run the function
SELECT setup_chat_storage();

-- ==============================================================================

-- METHOD 4: Using Supabase CLI (if installed)
-- Run: npx supabase db push
-- Or: supabase db push

-- ==============================================================================

-- VERIFICATION: Check bucket status
SELECT 
  b.id as bucket_id,
  b.name,
  b.public,
  b.file_size_limit,
  (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'chat-attachments') as file_count
FROM storage.buckets b
WHERE b.id = 'chat-attachments';

-- Check policies
SELECT 
  policyname,
  cmd,
  CASE WHEN qual IS NULL THEN 'no USING' ELSE 'has USING' END as has_using,
  CASE WHEN with_check IS NULL THEN 'no WITH CHECK' ELSE 'has WITH CHECK' END as has_with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
ORDER BY policyname;
