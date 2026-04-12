# Backup Restore Guide

## Backup Information
- **Backup Version**: {{BACKUP_VERSION}}
- **Backup Date**: {{BACKUP_DATE}}
- **Backup Type**: {{BACKUP_TYPE}} ({{MANUAL_OR_AUTOMATIC}})
- **Created By**: {{CREATED_BY}}
- **Completeness**: {{COMPLETENESS_STATUS}}
- **Is Fully Restorable**: {{IS_FULL_RESTORABLE}}

---

## Archive Contents

This backup archive contains:

### 1. Database Export (`database-export.json`)
Contains snapshots of the following tables:
{{TABLES_LIST}}

**Total Records**: {{TOTAL_RECORD_COUNT}}

### 2. Storage Files (`storage/`)
Files organized by Supabase Storage bucket:
{{STORAGE_BUCKETS_INFO}}

**Total Files**: {{TOTAL_STORAGE_FILES}}
**Total Storage Size**: {{TOTAL_STORAGE_SIZE}} bytes

### 3. External References (`external_images`)
External image URLs found in profiles (reference only):
{{EXTERNAL_IMAGES_COUNT}} URLs recorded

---

## Prerequisites

### Required Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Drive (for downloading backup from Drive)
GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH=/path/to/service-account.json
GOOGLE_DRIVE_FOLDER_ID=your-folder-id

# Optional: For Supabase Management API
SUPABASE_ACCESS_TOKEN=your-access-token
```

### Required Permissions
- Supabase: Service role key with full database and storage access
- Google Drive: Drive API access to download backup archive

---

## Restore Methods

### Method 1: Automated Restore Script (Recommended)

```bash
# From Google Drive
npm run restore:drive -- --backup-date 2026-04-12 --force

# From local ZIP file
npm run restore:local -- --file ./backup-2026-04-12.zip --force

# Dry run (validate without writing)
npm run restore:local -- --file ./backup-2026-04-12.zip --dry-run
```

### Method 2: Manual Restore

1. Download backup archive from Google Drive
2. Extract ZIP contents
3. Restore database using Supabase Management API
4. Upload storage files to Supabase Storage buckets
5. Run verification

---

## Restore Steps (Detailed)

### Step 1: Prepare Environment

```bash
cd server
cp .env.example .env
# Edit .env with your production credentials
```

### Step 2: Validate Backup Archive

```bash
# Verify archive integrity
npm run restore:verify -- --file ./backup-2026-04-12.zip
```

This will:
- Verify ZIP structure and contents
- Parse and validate manifest
- Check file counts and sizes
- Report any issues

### Step 3: Restore Database

```bash
# Restore database (creates/updates records)
npm run restore:db -- --file ./backup-2026-04-12.zip --mode upsert

# Available modes:
# - upsert: Insert new records, update existing (recommended)
# - insert: Only insert new records (skip existing)
# - replace: Delete all then re-insert (DANGEROUS)
```

### Step 4: Restore Storage Files

```bash
# Restore all storage files
npm run restore:storage -- --file ./backup-2026-04-12.zip

# Restore specific bucket only
npm run restore:storage -- --file ./backup-2026-04-12.zip --bucket person-images
```

### Step 5: Verify Restore

```bash
# Full verification
npm run restore:verify -- --file ./backup-2026-04-12.zip --full

# Quick verification
npm run restore:verify -- --file ./backup-2026-04-12.zip --quick
```

---

## Bucket Structure Mapping

Files in the archive are organized as:
```
storage/{bucket_name}/{path}
```

| Archive Path | Supabase Bucket | Storage Path |
|--------------|-----------------|---------------|
| storage/person-images/abc123/photo.jpg | person-images | abc123/photo.jpg |
| storage/attachments/xyz789/doc.pdf | attachments | xyz789/doc.pdf |
| storage/profile-assets/... | profile-assets | ... |
| storage/chat-files/... | chat-files | ... |

---

## Safety Features

### Idempotency
- **Database**: Uses upsert mode by default - safe to run multiple times
- **Storage**: Checks if file exists before upload, can skip or overwrite

### Dry Run Mode
Use `--dry-run` to validate without making changes:
```bash
npm run restore:local -- --file ./backup.zip --dry-run
```

### Backup Before Restore
The script will:
1. Create a backup of current state before restore (if `--backup-first` specified)
2. Log all operations for audit trail
3. Provide rollback instructions if needed

---

## Restore Report

After restore completes, a report is generated:

```
========================================
        RESTORE REPORT
========================================
Status: SUCCESS / PARTIAL / FAILED

Database Restore:
  - Tables processed: X
  - Records inserted: X
  - Records updated: X
  - Records skipped: X
  - Errors: X

Storage Restore:
  - Buckets processed: X
  - Files uploaded: X
  - Files skipped (exists): X
  - Files failed: X
  - Bytes transferred: X

Verification:
  - Database matches: YES/NO
  - Storage matches: YES/NO
  - File integrity: X/Y files verified

========================================
```

---

## Troubleshooting

### "Bucket not found" Error
Ensure the buckets exist in Supabase Storage before restore:
```bash
# Create buckets via Supabase Dashboard
# Or use Management API
```

### "Permission denied" Error
Verify your SUPABASE_SERVICE_ROLE_KEY has:
- Storage Admin permissions
- Database insert/update permissions

### "File too large" Error
Check Supabase Storage size limits for your plan.

### Database Restore Fails
- Check for foreign key constraint violations
- Ensure referenced records exist
- Try `--mode insert` to skip problematic records

### Storage Upload Fails
- Check bucket exists and is accessible
- Verify file paths don't exceed 255 characters
- Ensure sufficient storage quota

---

## Rollback Instructions

If restore fails catastrophically:

1. **Database**: Restore from a recent database backup in Supabase Dashboard
2. **Storage**: Delete incorrectly uploaded files manually or via script

---

## Support

For issues, check:
1. Server logs in terminal output
2. Supabase logs in Dashboard
3. Restore report for specific errors

---

*This README was generated with backup restore tool v{{TOOL_VERSION}}*
*Generated at: {{GENERATED_AT}}*
