-- Migration: Fix client_profiles table RLS and schema
-- Run this in Supabase SQL Editor

-- 1. Add slno column if not exists (for ordering)
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS slno SERIAL;

-- 2. Enable RLS
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Enable read access for all users" ON client_profiles;
DROP POLICY IF EXISTS "Enable insert for all users" ON client_profiles;
DROP POLICY IF EXISTS "Enable update for all users" ON client_profiles;
DROP POLICY IF EXISTS "Enable delete for all users" ON client_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON client_profiles;

-- 4. Create new RLS policies for client_profiles

-- Allow authenticated users to read all client_profiles (for browse page)
CREATE POLICY "Authenticated users can read client profiles"
    ON client_profiles FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile"
    ON client_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own profile
CREATE POLICY "Users can update own profile"
    ON client_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own profile
CREATE POLICY "Users can delete own profile"
    ON client_profiles FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id ON client_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_created_at ON client_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_profiles_is_profile_active ON client_profiles(is_profile_active);

-- 6. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON client_profiles TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE client_profiles_slno_seq TO anon, authenticated;

-- 7. Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'client_profiles' 
ORDER BY ordinal_position;
