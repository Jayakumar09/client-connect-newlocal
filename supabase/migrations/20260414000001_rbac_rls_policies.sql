-- ============================================================
-- RLS Policies for Matrimony App - Role-Based Access Control
-- ============================================================
-- Run this in Supabase SQL Editor
-- This ensures clients can only access their own data while admins can see all

-- ============================================================
-- 1. CLIENT_PROFILES TABLE POLICIES
-- ============================================================

-- Enable RLS on client_profiles
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON client_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON client_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON client_profiles;
DROP POLICY IF EXISTS "Enable insert for all users" ON client_profiles;
DROP POLICY IF EXISTS "Enable update for all users" ON client_profiles;
DROP POLICY IF EXISTS "Enable delete for all users" ON client_profiles;

-- CLIENT POLICY: Clients can ONLY read their own profiles
CREATE POLICY "Clients read own profiles"
ON client_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- CLIENT POLICY: Clients can ONLY insert their own profiles
CREATE POLICY "Clients insert own profiles"
ON client_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- CLIENT POLICY: Clients can ONLY update their own profiles
CREATE POLICY "Clients update own profiles"
ON client_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- CLIENT POLICY: Clients can ONLY delete their own profiles
CREATE POLICY "Clients delete own profiles"
ON client_profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================
-- 2. PERSONS TABLE POLICIES (Admin-only table)
-- ============================================================

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON persons;
DROP POLICY IF EXISTS "Users can insert profiles" ON persons;
DROP POLICY IF EXISTS "Users can update profiles" ON persons;
DROP POLICY IF EXISTS "Users can delete profiles" ON persons;

-- Only authenticated users can view persons (for admins)
CREATE POLICY "Authenticated users can view persons"
ON persons FOR SELECT
TO authenticated
USING (true);

-- Only service_role can modify persons (admin operations via server)
CREATE POLICY "Service role can manage persons"
ON persons FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 3. STORAGE BUCKET POLICIES
-- ============================================================

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing storage policies
DROP POLICY IF EXISTS "Public access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public read person-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- PUBLIC READ: Anyone can read images from person-images bucket
CREATE POLICY "Public read person-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'person-images');

-- CLIENT UPLOAD: Clients can only upload to their own folder (user_id/)
CREATE POLICY "Clients upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'person-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- CLIENT UPDATE: Clients can only update their own files
CREATE POLICY "Clients update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'person-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'person-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- CLIENT DELETE: Clients can only delete their own files
CREATE POLICY "Clients delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'person-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SERVICE ROLE: Full access for admin operations
CREATE POLICY "Service role full access"
ON storage.objects FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 4. SUBSCRIPTIONS TABLE POLICIES
-- ============================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update subscriptions" ON subscriptions;

-- Clients can view their own subscriptions
CREATE POLICY "Users view own subscriptions"
ON subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Clients can insert their own subscriptions
CREATE POLICY "Users insert own subscriptions"
ON subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Clients can update their own subscriptions
CREATE POLICY "Users update own subscriptions"
ON subscriptions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role for admin
CREATE POLICY "Service role manage subscriptions"
ON subscriptions FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 5. SHORTSLIST TABLE POLICIES
-- ============================================================

ALTER TABLE shortlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON shortlists;
DROP POLICY IF EXISTS "Users can view own shortlists" ON shortlists;
DROP POLICY IF EXISTS "Users can insert shortlists" ON shortlists;
DROP POLICY IF EXISTS "Users can delete shortlists" ON shortlists;

-- Clients can view their own shortlists
CREATE POLICY "Users view own shortlists"
ON shortlists FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = shortlisted_user_id);

-- Clients can create shortlists
CREATE POLICY "Users insert own shortlists"
ON shortlists FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Clients can delete their own shortlists
CREATE POLICY "Users delete own shortlists"
ON shortlists FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Service role for admin
CREATE POLICY "Service role manage shortlists"
ON shortlists FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 6. INTERESTS TABLE POLICIES
-- ============================================================

ALTER TABLE interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON interests;
DROP POLICY IF EXISTS "Users can view own interests" ON interests;
DROP POLICY IF EXISTS "Users can insert interests" ON interests;
DROP POLICY IF EXISTS "Users can update interests" ON interests;
DROP POLICY IF EXISTS "Users can delete interests" ON interests;

-- Clients can view their own interests
CREATE POLICY "Users view own interests"
ON interests FOR SELECT
TO authenticated
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Clients can send interests
CREATE POLICY "Users insert own interests"
ON interests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = from_user_id);

-- Clients can update their own interests
CREATE POLICY "Users update own interests"
ON interests FOR UPDATE
TO authenticated
USING (auth.uid() = from_user_id)
WITH CHECK (auth.uid() = from_user_id);

-- Clients can delete their own interests
CREATE POLICY "Users delete own interests"
ON interests FOR DELETE
TO authenticated
USING (auth.uid() = from_user_id);

-- Service role for admin
CREATE POLICY "Service role manage interests"
ON interests FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 7. MESSAGES TABLE POLICIES
-- ============================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON messages;
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;

-- Clients can view their own messages
CREATE POLICY "Users view own messages"
ON messages FOR SELECT
TO authenticated
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Clients can send messages
CREATE POLICY "Users insert own messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = from_user_id);

-- Service role for admin
CREATE POLICY "Service role manage messages"
ON messages FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 8. PAYMENTS TABLE POLICIES
-- ============================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON payments;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert payments" ON payments;
DROP POLICY IF EXISTS "Users can update payments" ON payments;

-- Clients can view their own payments
CREATE POLICY "Users view own payments"
ON payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Clients can insert their own payments
CREATE POLICY "Users insert own payments"
ON payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Clients can update their own payments
CREATE POLICY "Users update own payments"
ON payments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role for admin
CREATE POLICY "Service role manage payments"
ON payments FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 9. USER_ROLES TABLE POLICIES (for admin detection)
-- ============================================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON user_roles;

-- Admin users can view roles
CREATE POLICY "Admin can view roles"
ON user_roles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
    OR auth.uid() = user_id
);

-- Service role for admin management
CREATE POLICY "Service role manage roles"
ON user_roles FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 10. BACKUP_LOGS TABLE POLICIES
-- ============================================================

ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read backup logs" ON backup_logs;
DROP POLICY IF EXISTS "Service role can manage backup logs" ON backup_logs;

-- Admin users can read backup logs
CREATE POLICY "Admins can read backup logs"
ON backup_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

-- Service role can manage backup logs
CREATE POLICY "Service role can manage backup logs"
ON backup_logs FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 11. PROFILE_VIEWS TABLE POLICIES
-- ============================================================

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON profile_views;

-- Clients can view their own profile views
CREATE POLICY "Users view own profile views"
ON profile_views FOR SELECT
TO authenticated
USING (auth.uid() = viewer_id OR auth.uid() = viewed_user_id);

-- Clients can insert their own profile views
CREATE POLICY "Users insert own profile views"
ON profile_views FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = viewer_id);

-- Service role for admin
CREATE POLICY "Service role manage profile views"
ON profile_views FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 12. GRANT PERMISSIONS
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON client_profiles TO authenticated, service_role;
GRANT ALL ON persons TO authenticated, service_role;
GRANT ALL ON subscriptions TO authenticated, service_role;
GRANT ALL ON shortlists TO authenticated, service_role;
GRANT ALL ON interests TO authenticated, service_role;
GRANT ALL ON messages TO authenticated, service_role;
GRANT ALL ON payments TO authenticated, service_role;
GRANT ALL ON user_roles TO authenticated, service_role;
GRANT ALL ON backup_logs TO authenticated, service_role;
GRANT ALL ON profile_views TO authenticated, service_role;

-- ============================================================
-- 13. VERIFICATION QUERIES
-- ============================================================

-- Check table sizes
SELECT 'client_profiles' as table_name, COUNT(*) as count FROM client_profiles
UNION ALL
SELECT 'persons', COUNT(*) FROM persons
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'shortlists', COUNT(*) FROM shortlists
UNION ALL
SELECT 'interests', COUNT(*) FROM interests;

-- List all RLS policies
SELECT tablename, policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
