-- Add completeness column to backup_logs table
-- Tracks restore-readiness of backups

ALTER TABLE backup_logs 
ADD COLUMN IF NOT EXISTS completeness TEXT DEFAULT 'unknown' 
CHECK (completeness IN ('db_only', 'partially_restorable', 'fully_restorable', 'unknown'));

COMMENT ON COLUMN backup_logs.completeness IS 'Backup completeness: db_only (database only), partially_restorable (some media missing), fully_restorable (complete)';

-- Backfill existing records based on file_count and error_message patterns
UPDATE backup_logs 
SET completeness = 'fully_restorable'
WHERE status = 'completed' 
AND error_message IS NULL;

UPDATE backup_logs 
SET completeness = 'db_only'
WHERE status = 'completed' 
AND error_message LIKE '%DB Only%';

UPDATE backup_logs 
SET completeness = 'partially_restorable'
WHERE status = 'completed' 
AND error_message LIKE '%Partially Restorable%';

UPDATE backup_logs 
SET completeness = 'fully_restorable'
WHERE status = 'completed' 
AND error_message LIKE '%Fully Restorable%';
