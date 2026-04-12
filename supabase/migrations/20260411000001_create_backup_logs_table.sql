-- Backup Logs Table
-- Tracks all backup operations for the Matrimony app

CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('manual', 'automatic')),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    file_count INTEGER DEFAULT 0,
    backup_size BIGINT DEFAULT 0,
    drive_folder_id TEXT,
    backup_date DATE NOT NULL,
    retention_deleted INTEGER DEFAULT 0,
    error_message TEXT,
    created_by TEXT NOT NULL
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_backup_logs_backup_date ON backup_logs(backup_date DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);
CREATE INDEX IF NOT EXISTS idx_backup_logs_type ON backup_logs(type);
CREATE INDEX IF NOT EXISTS idx_backup_logs_started_at ON backup_logs(started_at DESC);

-- Comments for documentation
COMMENT ON TABLE backup_logs IS 'Tracks all backup operations including manual and automatic backups';
COMMENT ON COLUMN backup_logs.type IS 'Type of backup: manual (triggered by admin) or automatic (scheduled)';
COMMENT ON COLUMN backup_logs.status IS 'Current status: in_progress, completed, or failed';
COMMENT ON COLUMN backup_logs.backup_size IS 'Total size of backup in bytes';
COMMENT ON COLUMN backup_logs.drive_folder_id IS 'Google Drive folder ID where backup is stored';
COMMENT ON COLUMN backup_logs.backup_date IS 'The date of the backup (YYYY-MM-DD)';
COMMENT ON COLUMN backup_logs.retention_deleted IS 'Number of old backups deleted due to retention policy';
COMMENT ON COLUMN backup_logs.error_message IS 'Error message if backup failed';
COMMENT ON COLUMN backup_logs.created_by IS 'Email of the admin who triggered or scheduled the backup';

-- RLS Policies (Row Level Security)
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all backup logs
CREATE POLICY "Admins can read backup logs"
    ON backup_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Only service role can insert/update/delete (handled by server)
CREATE POLICY "Service role can manage backup logs"
    ON backup_logs FOR ALL
    USING (auth.role() = 'service_role');
