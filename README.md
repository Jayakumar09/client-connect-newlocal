# Sri Lakshmi Mangalya Malai - Matrimony App

## Project Structure

```
client-connect-main/
├── src/                           # React frontend (Vite + TypeScript)
│   ├── components/
│   │   ├── StorageSummary.tsx     # Reusable storage summary card
│   │   ├── BackupButton.tsx       # Backup trigger with dropdown
│   │   └── BackupDialog.tsx        # Comprehensive backup management
│   ├── contexts/
│   │   └── BackupContext.tsx       # Global backup state management
│   ├── hooks/
│   │   └── useStorageSummary.ts    # Shared storage/backup summary hooks
│   ├── pages/
│   │   └── Dashboard.tsx           # Admin dashboard (with storage health)
│   ├── integrations/
│   │   ├── client.ts              # Supabase client
│   │   └── types.ts               # Database types (incl. backup_logs)
│   └── components/
│       ├── PersonDialog.tsx       # Add/Edit with shared storage
│       └── PersonViewDialog.tsx    # View with storage summary
│
├── server/                         # Node.js/Express backend
│   ├── src/
│   │   ├── services/
│   │   │   ├── backup-service.ts      # Core backup logic
│   │   │   └── google-drive-service.ts # Google Drive API
│   │   ├── routes/
│   │   │   ├── backup-routes.ts       # /api/backup/* endpoints
│   │   │   └── admin-routes.ts        # /api/admin/* endpoints
│   │   ├── scripts/
│   │   │   └── scheduler.ts          # Cron job (daily 2 AM IST)
│   │   └── types/
│   │       ├── index.ts             # Backup service types
│   │       └── admin.ts            # Admin API types
│   └── package.json
│
└── supabase/
    └── migrations/
        └── 20260411000001_create_backup_logs_table.sql
```

---

## Storage Monitoring System

Production-ready storage and backup monitoring with consistent UI across all admin components.

### Features

- **Unified Storage Service**: Single `useStorageSummary` hook for all components
- **Consistent UI**: `StorageSummaryCard` component used in Dashboard, PersonDialog, PersonViewDialog
- **Warning Thresholds**: 70% → Moderate, 85% → Warning, 95% → Critical, 100% → Limit Reached
- **Status Labels**: Healthy, Moderate Usage, Approaching Limit, Critical, Limit Reached
- **Auto-refresh**: Storage metrics refresh on modal open, add/edit/delete, backup operations

### Storage Display Locations

| Component | Storage Info Shown |
|-----------|-------------------|
| Dashboard | StorageSummaryCard + SystemHealth card in header |
| Add Person | Storage usage alert with upload blocking |
| Edit Person | Storage usage alert with upload blocking |
| View Person | Profile attachments count + system storage status |
| Backup Dialog | Comprehensive backup metrics and history |

### Warning Levels

| Level | Threshold | Color | Message |
|-------|-----------|-------|---------|
| None | <70% | Green | Healthy |
| 70 | 70-84% | Blue | Moderate Usage |
| 85 | 85-94% | Orange | Approaching Limit |
| 95 | 95-99% | Red | Critical |
| 100 | 100% | Dark Red | Limit Reached - Upgrade Required |

---

## Backup System

Comprehensive backup system for automated daily backups to Google Drive.

### Features

- Manual and automatic daily backups (2 AM IST)
- PostgreSQL database export from Supabase
- Profile images/files from Supabase Storage
- External image URLs preservation
- Google Drive upload: `Vijayalakshmi_Matrimony_Backups/YYYY-MM-DD`
- 7-day FIFO retention policy
- Duplicate prevention (unless forced)
- Retry handling (3 attempts, 5s delay)
- Real-time SSE progress tracking
- Toast notifications
- Status banners: Healthy, Moderate, Warning, Critical, Limit Reached

### Quick Setup

**1. Database Migration**
Run in Supabase SQL Editor:
```sql
-- supabase/migrations/20260411000001_create_backup_logs_table.sql
```

**2. Backend Setup**
```bash
cd server
npm install
cp .env.example .env
# Edit .env with credentials (see below)
npm run dev
```

**3. Start Scheduler** (separate terminal)
```bash
cd server
npm run scheduler
```

**4. Frontend Environment** (.env)
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKUP_API_URL=http://localhost:3001
VITE_ADMIN_API_KEY=your-secure-admin-api-key
```

### API Endpoints

#### Backup Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/backup/trigger` | Start backup (manual) |
| GET | `/api/backup/status` | Current backup status |
| GET | `/api/backup/logs` | Backup history |
| POST | `/api/backup/cleanup` | Force retention cleanup |

#### Admin Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/storage/summary` | Storage used/remaining/percentage |
| GET | `/api/admin/storage/profile/:id` | Profile-specific storage |
| GET | `/api/admin/backups/summary` | Backup count/size/next scheduled |
| GET | `/api/admin/backups/history` | Backup logs |
| GET | `/api/admin/health` | Supabase/Drive connection status |

### Backend Environment Variables (server/.env)

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google Drive (OAuth or Service Account)
GOOGLE_DRIVE_CLIENT_ID=your-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=your-refresh-token
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
GOOGLE_DRIVE_FOLDER_NAME=Vijayalakshmi_Matrimony_Backups

# Server
PORT=3001
BACKUP_RETENTION_DAYS=7
ADMIN_API_KEY=your-secure-admin-api-key
```

### Google Drive Setup

1. Create OAuth2 credentials in Google Cloud Console
2. Or create service account with Drive API enabled
3. Share folder `Vijayalakshmi_Matrimony_Backups` with credentials

---

## Development

```bash
# Frontend
npm run dev

# Backend
cd server && npm run dev

# Scheduler (daily auto backups)
cd server && npm run scheduler
```

---

## Documentation

- [BACKUP_SYSTEM.md](./BACKUP_SYSTEM.md) - Detailed backup system documentation