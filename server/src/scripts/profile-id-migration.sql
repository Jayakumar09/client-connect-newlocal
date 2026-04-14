-- Migration: Add Profile ID System
-- This migration adds a permanent, globally unique Profile ID across Admin Records and Client Profiles
-- Profile ID Format: VBM26_XXXXXX (e.g., VBM26_000001, VBM26_000002)

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

-- Step 8: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_persons_profile_id ON persons(profile_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_profile_id ON client_profiles(profile_id);
CREATE INDEX IF NOT EXISTS idx_persons_created_at ON persons(created_at);
CREATE INDEX IF NOT EXISTS idx_client_profiles_created_at ON client_profiles(created_at);

-- Verify the changes
SELECT 'Profile ID system migration completed' AS status;
