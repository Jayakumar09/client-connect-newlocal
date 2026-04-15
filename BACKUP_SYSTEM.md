# Backup System Documentation

## Overview

The backup system provides automated and manual backup capabilities for the Matrimony app, including:
- PostgreSQL database export from Supabase
- Profile images and files from Supabase Storage
- External image URLs referenced in client profiles
- Upload to Google Drive with automatic 7-day retention (FIFO)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  BackupButton    │  │  BackupDialog   │  │ BackupContext │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘  │
└───────────┼──────────────────────┼────────────────────┼──────────┘
            │                      │                    │
            └──────────────────────┴────────────────────┘
                                   │ HTTP/SSE
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Backup API Routes                        │ │
│  │  POST /api/backup/trigger  GET /api/backup/status         │ │
│  │  GET /api/backup/logs      POST /api/backup/cleanup        │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────┐  ┌────────────────────────────────┐ │
│  │  BackupService        │  │  GoogleDriveService            │ │
│  │  - DB Export          │  │  - Folder Management          │ │
│  │  - File Collection    │  │  - File Upload                 │ │
│  │  - Archive Creation   │  │  - Retention Policy            │ │
│  └──────────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────┐    ┌─────────────────────┐
│   Supabase          │    │   Google Drive      │
│   - PostgreSQL DB   │    │   Vijayalakshmi_    │
│   - Storage Bucket  │    │   Matrimony_Backups │
│   - backup_logs     │    │   /YYYY-MM-DD       │
└─────────────────────┘    └─────────────────────┘
```

## Components

### Frontend

| Component | Location | Purpose |
|-----------|----------|---------|
| `BackupContext` | `src/contexts/BackupContext.tsx` | Global state management for backup operations |
| `BackupButton` | `src/components/BackupButton.tsx` | Backup trigger button with dropdown menu |
| `BackupDialog` | `src/components/BackupDialog.tsx` | Modal showing backup status, logs, and history |

### Backend

| Component | Location | Purpose |
|-----------|----------|---------|
| `backup-service.ts` | `server/src/services/` | Core backup logic (DB export, file collection, archiving) |
| `google-drive-service.ts` | `server/src/services/` | Google Drive API integration |
| `backup-routes.ts` | `server/src/routes/` | REST API endpoints |
| `scheduler.ts` | `server/src/scripts/` | Cron job for automatic daily backups |

## API Endpoints

### POST /api/backup/trigger

Triggers a new backup operation.

**Headers:**
- `X-Admin-API-Key`: Admin API key

**Body:**
```json
{
  "force": false
}
```

**Response:** Server-Sent Events (SSE) stream with progress updates

### GET /api/backup/status

Returns current backup status and statistics.

**Headers:**
- `X-Admin-API-Key`: Admin API key

**Response:**
```json
{
  "isRunning": false,
  "lastBackup": { ... },
  "nextScheduledBackup": "2026-04-12T02:00:00.000Z",
  "totalBackupSize": 104857600,
  "retentionDays": 7,
  "recentBackups": [ ... ]
}
```

### GET /api/backup/logs

Returns backup history logs.

**Headers:**
- `X-Admin-API-Key`: Admin API key

**Query Parameters:**
- `limit`: Number of logs to return (default: 50)

### POST /api/backup/cleanup

Manually triggers cleanup of old backups based on retention policy.

## Database Schema

### backup_logs Table

```sql
CREATE TABLE backup_logs (
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
```

## Environment Variables

### Frontend (.env)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKUP_API_URL=http://localhost:3001
VITE_ADMIN_API_KEY=your-secure-admin-api-key
```

### Backend (server/.env)

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_ACCESS_TOKEN=your-access-token

# Google Drive
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account-key.json
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
GOOGLE_DRIVE_FOLDER_NAME=Vijayalakshmi_Matrimony_Backups

# Server
PORT=3001
NODE_ENV=production

# Backup Settings
BACKUP_RETENTION_DAYS=7
BACKUP_RETRY_ATTEMPTS=3
BACKUP_RETRY_DELAY_MS=5000
BACKUP_TEMP_DIR=./temp-backups
ADMIN_API_KEY=your-secure-admin-api-key
```

## Setup Instructions

### 1. Supabase Database Setup

Run the migration to create the `backup_logs` table:

```sql
-- Apply in Supabase SQL Editor or via CLI
-- File: supabase/migrations/20260411000001_create_backup_logs_table.sql
```

### 2. Google Drive Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable Google Drive API
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create a new service account
   - Generate a JSON key file
5. Share your Google Drive folder with the service account email:
   - `your-service-account@project.iam.gserviceaccount.com`
   - Grant "Editor" access to `Vijayalakshmi_Matrimony_Backups` folder

### 3. Backend Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your values
```

### 4. Run the Server

Development:
```bash
cd server
npm run dev
```

Production:
```bash
cd server
npm run build
npm start
```

### 5. Run the Scheduler

```bash
cd server
npm run scheduler
```

### 6. Frontend Configuration

Add to your `.env`:
```env
VITE_BACKUP_API_URL=http://localhost:3001
VITE_ADMIN_API_KEY=your-secure-admin-api-key
```

## Backup Process

### Stages

1. **initializing** - Setup and validation
2. **exporting_database** - Export all Supabase tables to JSON
3. **collecting_files** - Collect storage files and external images
4. **creating_archive** - Create ZIP archive with all data
5. **uploading** - Upload to Google Drive
6. **cleaning_up** - Remove temporary files
7. **completed** or **failed**

### Backup Contents

```
Vijayalakshmi_Matrimony_Backups/
└── 2026-04-11/
    ├── backup-2026-04-11.zip      # Complete backup archive
    └── backup-manifest.json        # Metadata for restore
```

### Archive Contents

```
backup-YYYY-MM-DD.zip
├── database-export.json           # All database tables
├── storage/                       # Supabase Storage files
│   └── person-images/
│       └── ...
└── (manifest generated separately)
```

## Retention Policy

- **7-day FIFO**: Only the 7 most recent daily backups are kept
- **Automatic cleanup**: When a new backup is created, the oldest backup is deleted
- **Manual cleanup**: Available via "Cleanup Old Backups" option
- **Folder structure**: Each backup stored in `Vijayalakshmi_Matrimony_Backups/YYYY-MM-DD/`

## Duplicate Prevention

- By default, same-day backups are prevented
- Use "Force Backup" to create a new backup even if one exists for today
- Force backup replaces the existing same-day backup

## Error Handling

- **Retry logic**: 3 attempts with 5-second delay for transient failures
- **Error logging**: All errors stored in `backup_logs.error_message`
- **Toast notifications**: Frontend shows success/failure toasts
- **Progress streaming**: Real-time progress via SSE

## Security

- Admin API key required for all endpoints
- Supabase Service Role Key only on server (never frontend)
- Google Drive credentials stored server-side only
- RLS policies on backup_logs table

## Monitoring

Monitor backup health via:

1. **Frontend**: Backup button shows last backup status
2. **Backup Dialog**: Full history with success/failure states
3. **Supabase**: Query `backup_logs` table directly
4. **Google Drive**: Check folder for backup files
5. **Server logs**: All backup operations logged to console

## Troubleshooting

### Backup fails with "Duplicate backup"

- Use force=true or click "Force Backup (Today)"

### Google Drive upload fails

- Check service account email has access to folder
- Verify GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH is correct
- Check service account has Drive API enabled

### Database export fails

- Verify VITE_SUPABASE_ANON_KEY is correct
- Check Supabase project is accessible
- Review table permissions

### Storage collection fails

- Some files may be inaccessible (logged as warnings)
- Backup continues with available files

## Production Deployment

For production, consider:

1. **Process manager**: Use PM2 to keep scheduler running
2. **Monitoring**: Set up alerts for failed backups
3. **Logging**: Configure structured logging (Winston/Pino)
4. **SSL**: Use HTTPS for the backup API
5. **Secrets**: Use a secrets manager for credentials
6. **Scheduled jobs**: Use system cron + PM2 for reliability

Example PM2 setup:
```bash
npm install -g pm2
pm2 start npm --name "backup-scheduler" -- run scheduler
pm2 save
pm2 startup
```
