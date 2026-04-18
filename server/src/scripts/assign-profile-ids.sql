-- Assign Profile IDs to Existing Records
-- Run this AFTER profile-id-migration.sql
-- This assigns Profile IDs to existing records based on created_at ordering

-- Step 1: Assign Profile IDs to existing persons records (ordered by created_at)
DO $$
DECLARE
    rec RECORD;
    new_profile_id TEXT;
BEGIN
    -- Get all persons without profile_id, ordered by created_at
    FOR rec IN 
        SELECT p.id, p.created_at, p.slno
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

-- Step 2: Assign Profile IDs to existing client_profiles records (ordered by created_at)
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

-- Step 3: Verify migration results
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

-- Show migration log summary
SELECT 
    table_name,
    COUNT(*) AS migrated_count,
    MIN(profile_id) AS first_id,
    MAX(profile_id) AS last_id
FROM profile_id_migration_log
GROUP BY table_name;

SELECT 'Existing records Profile ID assignment completed' AS status;
