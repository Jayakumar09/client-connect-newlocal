-- ==============================================================================
-- Profile ID System Migration Script for Supabase
-- ==============================================================================
-- Run this script in Supabase SQL Editor (Dashboard > SQL Editor)
-- This adds a permanent, globally unique Profile ID across Admin Records and Client Profiles
-- Profile ID Format: VBM26_XXXXXX (e.g., VBM26_000001, VBM26_000002)
-- ==============================================================================

-- Step 1: Create the profile_id_sequence table for centralized, transaction-safe ID generation
CREATE TABLE IF NOT EXISTS profile_id_sequence (
    id TEXT PRIMARY KEY DEFAULT 'global',
    last_number INTEGER NOT NULL DEFAULT 0,
    year_prefix TEXT NOT NULL DEFAULT 'VBM26',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize sequence if not exists
INSERT INTO profile_id_sequence (id, last_number, year_prefix)
VALUES ('global', 0, 'VBM26')
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create function to get next Profile ID (transaction-safe)
CREATE OR REPLACE FUNCTION get_next_profile_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    v_last_number INTEGER;
    v_year_prefix TEXT;
BEGIN
    -- Use row-level lock to prevent race conditions
    UPDATE profile_id_sequence
    SET last_number = last_number + 1,
        updated_at = NOW()
    WHERE id = 'global'
    RETURNING last_number, year_prefix INTO v_last_number, v_year_prefix;
    
    -- Generate formatted ID: VBM26_000001
    new_id := v_year_prefix || '_' || LPAD(v_last_number::TEXT, 6, '0');
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Add profile_id column to persons table
ALTER TABLE persons ADD COLUMN IF NOT EXISTS profile_id TEXT UNIQUE;

-- Step 4: Add profile_id column to client_profiles table
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS profile_id TEXT UNIQUE;

-- Step 5: Create trigger function to auto-generate Profile ID on insert
CREATE OR REPLACE FUNCTION assign_profile_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign if profile_id is NULL (not provided)
    IF NEW.profile_id IS NULL OR NEW.profile_id = '' THEN
        NEW.profile_id := get_next_profile_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create triggers for both tables
DROP TRIGGER IF EXISTS persons_profile_id_trigger ON persons;
CREATE TRIGGER persons_profile_id_trigger
    BEFORE INSERT ON persons
    FOR EACH ROW
    EXECUTE FUNCTION assign_profile_id_on_insert();

DROP TRIGGER IF EXISTS client_profiles_profile_id_trigger ON client_profiles;
CREATE TRIGGER client_profiles_profile_id_trigger
    BEFORE INSERT ON client_profiles
    FOR EACH ROW
    EXECUTE FUNCTION assign_profile_id_on_insert();

-- Step 7: Create migration tracking table
CREATE TABLE IF NOT EXISTS profile_id_migration_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_slno INTEGER,
    profile_id TEXT NOT NULL,
    migrated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 8: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_persons_profile_id ON persons(profile_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_profile_id ON client_profiles(profile_id);

-- ==============================================================================
-- Migration completed for schema. Now assigning Profile IDs to existing records.
-- ==============================================================================

-- Step 9: Assign Profile IDs to existing persons records (ordered by created_at)
DO $$
DECLARE
    rec RECORD;
    new_profile_id TEXT;
BEGIN
    -- Get all persons without profile_id, ordered by created_at
    FOR rec IN 
        SELECT p.id, p.created_at, COALESCE(p.slno, 0) as slno
        FROM persons p
        WHERE p.profile_id IS NULL
        ORDER BY p.created_at ASC NULLS LAST
    LOOP
        -- Get next Profile ID
        SELECT get_next_profile_id() INTO new_profile_id;
        
        -- Update the record
        UPDATE persons SET profile_id = new_profile_id WHERE id = rec.id;
        
        -- Log the migration
        INSERT INTO profile_id_migration_log (table_name, record_id, old_slno, profile_id)
        VALUES ('persons', rec.id, rec.slno, new_profile_id);
    END LOOP;
    
    RAISE NOTICE 'Persons migration completed';
END $$;

-- Step 10: Assign Profile IDs to existing client_profiles records (ordered by created_at)
DO $$
DECLARE
    rec RECORD;
    new_profile_id TEXT;
BEGIN
    -- Get all client_profiles without profile_id, ordered by created_at
    FOR rec IN 
        SELECT cp.id, cp.created_at
        FROM client_profiles cp
        WHERE cp.profile_id IS NULL
        ORDER BY cp.created_at ASC NULLS LAST
    LOOP
        -- Get next Profile ID
        SELECT get_next_profile_id() INTO new_profile_id;
        
        -- Update the record
        UPDATE client_profiles SET profile_id = new_profile_id WHERE id = rec.id;
        
        -- Log the migration
        INSERT INTO profile_id_migration_log (table_name, record_id, profile_id)
        VALUES ('client_profiles', rec.id, new_profile_id);
    END LOOP;
    
    RAISE NOTICE 'Client profiles migration completed';
END $$;

-- ==============================================================================
-- Verification: Check migration results
-- ==============================================================================

-- Check counts
SELECT 
    'persons' AS table_name,
    COUNT(*) AS total_records,
    COUNT(profile_id) AS with_profile_id,
    COUNT(*) - COUNT(profile_id) AS missing_profile_id
FROM persons
UNION ALL
SELECT 
    'client_profiles' AS table_name,
    COUNT(*) AS total_records,
    COUNT(profile_id) AS with_profile_id,
    COUNT(*) - COUNT(profile_id) AS missing_profile_id
FROM client_profiles;

-- Check sequence status
SELECT 
    last_number,
    year_prefix,
    year_prefix || '_' || LPAD((last_number + 1)::TEXT, 6, '0') AS next_profile_id
FROM profile_id_sequence
WHERE id = 'global';

-- Show sample Profile IDs
SELECT 'Sample Admin Records (persons):' AS info;
SELECT profile_id, name FROM persons WHERE profile_id IS NOT NULL ORDER BY created_at LIMIT 5;

SELECT 'Sample Client Profiles:' AS info;
SELECT profile_id, full_name FROM client_profiles WHERE profile_id IS NOT NULL ORDER BY created_at LIMIT 5;

-- Show migration log summary
SELECT 
    table_name,
    COUNT(*) AS migrated_count,
    MIN(profile_id) AS first_id,
    MAX(profile_id) AS last_id
FROM profile_id_migration_log
GROUP BY table_name;

-- Final success message
SELECT '========================================' AS separator;
SELECT 'Profile ID migration completed successfully!' AS status;
SELECT 'Profile ID Format: VBM26_XXXXXX' AS format;
SELECT 'Deleted IDs will never be reused' AS important_note;
SELECT '========================================' AS separator;
