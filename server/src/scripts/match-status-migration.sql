-- ==============================================================================
-- Match Status Migration Script for Supabase
-- ==============================================================================
-- Run this script in Supabase SQL Editor (Dashboard > SQL Editor)
-- This adds match/marriage tracking fields to persons and client_profiles tables
-- ==============================================================================

-- Step 1: Add match_status column to persons table
ALTER TABLE persons ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'active' CHECK (match_status IN ('active', 'matched'));

-- Step 2: Add match fields to persons table
ALTER TABLE persons ADD COLUMN IF NOT EXISTS matched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS matched_by TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS matched_with_id UUID;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS match_remarks TEXT;

-- Step 3: Add match_status column to client_profiles table
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'active' CHECK (match_status IN ('active', 'matched'));

-- Step 4: Add match fields to client_profiles table
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS matched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS matched_by TEXT;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS matched_with_id UUID;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS match_remarks TEXT;

-- Step 5: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_persons_match_status ON persons(match_status);
CREATE INDEX IF NOT EXISTS idx_client_profiles_match_status ON client_profiles(match_status);
CREATE INDEX IF NOT EXISTS idx_persons_matched_at ON persons(matched_at);
CREATE INDEX IF NOT EXISTS idx_client_profiles_matched_at ON client_profiles(matched_at);

-- ==============================================================================
-- Verification
-- ==============================================================================

-- Check persons table columns
SELECT 'persons table columns:' AS info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'persons' 
AND column_name IN ('match_status', 'matched_at', 'matched_by', 'matched_with_id', 'match_remarks')
ORDER BY column_name;

-- Check client_profiles table columns
SELECT 'client_profiles table columns:' AS info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'client_profiles' 
AND column_name IN ('match_status', 'matched_at', 'matched_by', 'matched_with_id', 'match_remarks')
ORDER BY column_name;

-- Count records by match status
SELECT 'Match status counts:' AS info;
SELECT 'persons' AS table_name, match_status, COUNT(*) AS count FROM persons GROUP BY match_status
UNION ALL
SELECT 'client_profiles' AS table_name, match_status, COUNT(*) AS count FROM client_profiles GROUP BY match_status
ORDER BY table_name, match_status;

-- Final success message
SELECT '========================================' AS separator;
SELECT 'Match status migration completed successfully!' AS status;
SELECT '========================================' AS separator;
