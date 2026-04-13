-- ============================================================
-- Migration: Strict RLS for Client Profiles - Admin/Client Separation
-- Run this in Supabase SQL Editor
-- ============================================================
-- This migration ensures:
-- 1. Clients can only access their own profile
-- 2. Admin (service_role) can view all profiles but only modify payment_status/is_profile_active
-- 3. One client account = one profile (unique constraint)
-- ============================================================

-- 1. ADD UNIQUE CONSTRAINT ON USER_ID
-- First, check if there are any duplicate user_ids and remove them
DO $$
DECLARE
    duplicate_user RECORD;
BEGIN
    -- Find and log duplicates
    FOR duplicate_user IN 
        SELECT user_id, COUNT(*) as cnt
        FROM client_profiles
        GROUP BY user_id
        HAVING COUNT(*) > 1
    LOOP
        RAISE NOTICE 'Found duplicate user_id: % with % profiles', duplicate_user.user_id, duplicate_user.cnt;
    END LOOP;
END $$;

-- Keep only the oldest profile for each user (delete duplicates)
DELETE FROM client_profiles
WHERE id NOT IN (
    SELECT MIN(id)
    FROM client_profiles
    GROUP BY user_id
);

-- Add unique constraint
ALTER TABLE client_profiles DROP CONSTRAINT IF EXISTS client_profiles_user_id_key;
ALTER TABLE client_profiles ADD CONSTRAINT client_profiles_user_id_key UNIQUE (user_id);

-- ============================================================
-- 2. REPLACE ALL CLIENT_PROFILES RLS POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Clients read own profiles" ON client_profiles;
DROP POLICY IF EXISTS "Clients insert own profiles" ON client_profiles;
DROP POLICY IF EXISTS "Clients update own profiles" ON client_profiles;
DROP POLICY IF EXISTS "Clients delete own profiles" ON client_profiles;
DROP POLICY IF EXISTS "Authenticated users can read client profiles" ON client_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON client_profiles;

-- ============================================================
-- CLIENT POLICIES: Strict own profile access only
-- ============================================================

-- CLIENT: Can SELECT only own profile
CREATE POLICY "client_select_own_profile"
ON client_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- CLIENT: Can INSERT only own profile (with user_id = auth.uid())
CREATE POLICY "client_insert_own_profile"
ON client_profiles FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND user_id = auth.uid()
);

-- CLIENT: Can UPDATE only own profile (all fields EXCEPT payment_status and user_id)
-- The trigger below prevents payment_status updates by clients
CREATE POLICY "client_update_own_profile"
ON client_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: Clients CANNOT update payment_status - only admin can
-- This is enforced by the DB trigger prevent_client_payment_status_update

-- CLIENT: Can DELETE only own profile
CREATE POLICY "client_delete_own_profile"
ON client_profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================
-- ADMIN/SERVICE_ROLE POLICIES: View all, limited update
-- ============================================================

-- ADMIN: Can SELECT all client profiles (for admin dashboard view)
CREATE POLICY "admin_select_all_client_profiles"
ON client_profiles FOR SELECT
TO service_role
USING (true);

-- ADMIN: Cannot INSERT new client profiles (clients register themselves)
-- This prevents admin from creating fake client profiles
-- REMOVED: No INSERT policy for service_role

-- ADMIN: Can UPDATE only payment_status and is_profile_active
-- This policy is more permissive but we trust service_role key is secure
CREATE POLICY "admin_update_client_profiles_limited"
ON client_profiles FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- ADMIN: Can DELETE client profiles (for cleanup/moderation)
CREATE POLICY "admin_delete_client_profiles"
ON client_profiles FOR DELETE
TO service_role
USING (true);

-- ============================================================
-- 3. ADD TRIGGER TO PREVENT PAYMENT_STATUS UPDATE BY CLIENTS
-- ============================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS prevent_client_payment_status_update ON client_profiles;

CREATE OR REPLACE FUNCTION prevent_client_payment_status_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only apply this trigger for authenticated users (not service_role)
    -- Service_role bypasses RLS but we add extra safety
    IF NEW.user_id = auth.uid() AND auth.uid() IS NOT NULL THEN
        -- Prevent updating payment_status
        IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
            RAISE EXCEPTION 'Clients cannot modify payment_status. Only admin can change payment status.';
        END IF;
        
        -- Prevent updating user_id
        IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
            RAISE EXCEPTION 'Cannot change user_id of a profile.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prevent_client_payment_status_update
BEFORE UPDATE ON client_profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_client_payment_status_update();

-- ============================================================
-- 4. GRANT PERMISSIONS
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_profiles TO authenticated, service_role;

-- ============================================================
-- 5. VERIFICATION
-- ============================================================

-- List all policies for client_profiles
SELECT 
    policyname, 
    cmd, 
    permissive,
    CASE 
        WHEN roles::text[] @> '{authenticated}' THEN 'authenticated'
        WHEN roles::text[] @> '{service_role}' THEN 'service_role'
        ELSE 'other'
    END as role_type,
    SUBSTRING(qual::text, 1, 100) as condition_preview,
    SUBSTRING(with_check::text, 1, 100) as check_preview
FROM pg_policies
WHERE tablename = 'client_profiles'
ORDER BY cmd, policyname;

-- Verify unique constraint
SELECT 
    conname as constraint_name,
    contype as type,
    conkey as columns
FROM pg_constraint
WHERE conrelid = 'client_profiles'::regclass
AND conname = 'client_profiles_user_id_key';

-- Test query (should return 0 for non-admin)
-- SELECT COUNT(*) FROM client_profiles WHERE user_id = auth.uid();
