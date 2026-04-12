import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { backupService } from '../services/backup-service.js';
import { googleDriveService } from '../services/google-drive-service.js';
import { backupRetentionService } from '../services/backupRetentionService.js';
import { BackupProgress, StorageSummary, BackupSummary, BackupHistoryEntry, ProfileStorage, BackupStatusResponse, AdminDashboardSummary } from '../types/index.js';
import { BackupLog } from '../types/index.js';

const router = Router();
const BACKUP_RETENTION_COUNT = parseInt(process.env.BACKUP_RETENTION_COUNT || '7');

const ADMIN_EMAIL = 'vijayalakshmijayakumar45@gmail.com';
const LOG_PREFIX = '[AdminRoutes]';

function requireAdmin(req: Request, res: Response, next: (err?: Error) => void): void {
  const apiKey = req.headers['x-admin-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    console.error(`${LOG_PREFIX} Unauthorized access attempt from ${req.ip}`);
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: new Date().toISOString() });
    return;
  }
  next();
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function formatBytes(bytes: number): number {
  return bytes;
}

function calculateStatus(percent: number): 'healthy' | 'moderate' | 'warning' | 'critical' | 'limit_reached' {
  if (percent >= 100) return 'limit_reached';
  if (percent >= 95) return 'critical';
  if (percent >= 85) return 'warning';
  if (percent >= 70) return 'moderate';
  return 'healthy';
}

function calculateWarningLevel(percent: number): 'none' | '70' | '85' | '95' | '100' {
  if (percent >= 100) return '100';
  if (percent >= 95) return '95';
  if (percent >= 85) return '85';
  if (percent >= 70) return '70';
  return 'none';
}

function getNextScheduledBackup(): string {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(2, 0, 0, 0);
  return next.toISOString();
}

function formatBackupHistoryEntry(log: BackupLog): BackupHistoryEntry {
  return {
    id: log.id,
    type: log.type,
    status: log.status,
    startedAt: log.started_at,
    completedAt: log.completed_at,
    fileCount: log.file_count || 0,
    backupSize: log.backup_size || 0,
    driveFolderId: log.drive_folder_id,
    backupDate: log.backup_date,
    retentionDeleted: log.retention_deleted || 0,
    errorMessage: log.error_message,
    createdBy: log.created_by
  };
}

router.get('/storage/summary', requireAdmin, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] GET /api/admin/storage/summary - Fetching storage summary`);
  
  try {
    const supabase = getSupabase();
    
    let profileAssetCount = 0;
    let profileAssetBytes = 0;
    let dbRecordCount = 0;
    let usedBytes = 0;
    
    const { files, totalExpectedSize } = await backupService.collectStorageFiles();
    profileAssetCount = files.length;
    profileAssetBytes = totalExpectedSize;
    usedBytes += profileAssetBytes;
    console.log(`${LOG_PREFIX} Storage files: ${profileAssetCount} files, ${profileAssetBytes} bytes`);
    
    const tables = ['persons', 'client_profiles', 'payments', 'subscriptions', 'notifications', 'messages'];
    for (const table of tables) {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      dbRecordCount += count || 0;
    }
    console.log(`${LOG_PREFIX} Database records: ${dbRecordCount} total`);
    
    const estimatedDbBytes = dbRecordCount * 2048;
    usedBytes += estimatedDbBytes;
    
    const estimatedTotalBytes = 5368709120;
    const remainingBytes = Math.max(0, estimatedTotalBytes - usedBytes);
    const usagePercent = Math.min(100, (usedBytes / estimatedTotalBytes) * 100);
    
    const response: StorageSummary = {
      usedBytes,
      remainingBytes,
      totalBytes: estimatedTotalBytes,
      usagePercent: Math.round(usagePercent * 100) / 100,
      status: calculateStatus(usagePercent),
      warningLevel: calculateWarningLevel(usagePercent),
      profileAssetCount,
      profileAssetBytes,
      dbRecordCount,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`${LOG_PREFIX} Storage summary computed in ${Date.now() - startTime}ms - Status: ${response.status}, Usage: ${response.usagePercent}%`);
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error fetching storage summary:`, errorMessage);
    res.status(500).json({ error: errorMessage, code: 'STORAGE_SUMMARY_ERROR', timestamp: new Date().toISOString() });
  }
});

router.get('/storage/profile/:id', requireAdmin, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { id } = req.params;
  const profileId = Array.isArray(id) ? id[0] : id;
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] GET /api/admin/storage/profile/${profileId} - Fetching profile storage`);
  
  try {
    const supabase = getSupabase();
    
    let imageCount = 0;
    let galleryCount = 0;
    const totalBytes = 0;
    
    const { data: profile, error: profileError } = await supabase
      .from('persons')
      .select('profile_image, image_urls')
      .eq('id', profileId)
      .single();
    
    if (profileError || !profile) {
      console.warn(`${LOG_PREFIX} Profile not found: ${profileId}`);
      res.status(404).json({ error: 'Profile not found', code: 'PROFILE_NOT_FOUND', timestamp: new Date().toISOString() });
      return;
    }
    
    if (profile.profile_image) imageCount = 1;
    if (profile.image_urls && Array.isArray(profile.image_urls)) {
      galleryCount = profile.image_urls.length;
    }
    
    const totalAttachments = imageCount + galleryCount;
    
    const response: ProfileStorage = {
      profileId: profileId,
      profileName: profile.profile_image || 'Unknown',
      imageCount,
      galleryCount,
      totalAttachments,
      totalBytes,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`${LOG_PREFIX} Profile storage fetched in ${Date.now() - startTime}ms for profile: ${profileId}`);
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error fetching profile storage:`, errorMessage);
    res.status(500).json({ error: errorMessage, code: 'PROFILE_STORAGE_ERROR', timestamp: new Date().toISOString() });
  }
});

router.get('/backups/summary', requireAdmin, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] GET /api/admin/backups/summary - Fetching backup summary`);
  
  try {
    const supabase = getSupabase();
    
    const { data: backups, error } = await supabase
      .from('backup_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error(`${LOG_PREFIX} Error fetching backups:`, error.message);
      throw error;
    }
    
    const completedBackups = (backups || []).filter(b => b.status === 'completed');
    const backupCount = completedBackups.length;
    const backupTotalBytes = completedBackups.reduce((sum, b) => sum + (b.backup_size || 0), 0);
    
    const lastBackup = completedBackups[0] || null;
    
    const response: BackupSummary = {
      backupCount,
      backupTotalBytes,
      lastBackupAt: lastBackup?.completed_at || null,
      lastBackupSize: lastBackup?.backup_size || null,
      lastBackupStatus: lastBackup?.status || null,
      nextScheduledBackupAt: getNextScheduledBackup(),
      retentionPolicyDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '7'),
      retentionMaxCount: parseInt(process.env.BACKUP_RETENTION_COUNT || '7'),
      oldestBackupAt: completedBackups[completedBackups.length - 1]?.completed_at || null,
      newestBackupAt: lastBackup?.completed_at || null
    };
    
    console.log(`${LOG_PREFIX} Backup summary computed in ${Date.now() - startTime}ms - Count: ${backupCount}, Total size: ${backupTotalBytes}`);
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error fetching backup summary:`, errorMessage);
    res.status(500).json({ error: errorMessage, code: 'BACKUP_SUMMARY_ERROR', timestamp: new Date().toISOString() });
  }
});

router.get('/backups/history', requireAdmin, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const limit = parseInt(req.query.limit as string) || 50;
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] GET /api/admin/backups/history?limit=${limit} - Fetching backup history`);
  
  try {
    const supabase = getSupabase();
    
    const { data: backups, error } = await supabase
      .from('backup_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error(`${LOG_PREFIX} Error fetching backup history:`, error.message);
      throw error;
    }
    
    const formattedBackups = (backups || []).map(formatBackupHistoryEntry);
    
    console.log(`${LOG_PREFIX} Backup history fetched in ${Date.now() - startTime}ms - ${formattedBackups.length} entries`);
    res.json({
      success: true,
      data: formattedBackups,
      count: formattedBackups.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error fetching backup history:`, errorMessage);
    res.status(500).json({ error: errorMessage, code: 'BACKUP_HISTORY_ERROR', timestamp: new Date().toISOString() });
  }
});

router.get('/backups/list', requireAdmin, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] GET /api/admin/backups/list - Fetching last ${BACKUP_RETENTION_COUNT} backups`);
  
  try {
    const supabase = getSupabase();
    
    const { data: backups, error } = await supabase
      .from('backup_logs')
      .select('*')
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(BACKUP_RETENTION_COUNT);
    
    if (error) {
      console.error(`${LOG_PREFIX} Error fetching backups:`, error.message);
      throw error;
    }
     
    const formattedBackups = (backups || []).map(formatBackupHistoryEntry);
    
    const retentionStatus = await backupRetentionService.getRetentionStatus();
    const backupSizeInfo = await backupRetentionService.getTotalBackupSize();
    
    console.log(`${LOG_PREFIX} Backup list fetched in ${Date.now() - startTime}ms - ${formattedBackups.length} entries`);
    res.json({
      success: true,
      data: {
        backups: formattedBackups,
        retention: {
          policy: `${BACKUP_RETENTION_COUNT} backups (Auto-managed)`,
          totalBackups: retentionStatus.totalSuccessfulBackups,
          backupsToKeep: retentionStatus.backupsToKeep,
          backupsToDelete: retentionStatus.backupsToDelete,
          isCompliant: retentionStatus.isCompliant,
          newestBackup: retentionStatus.newestSuccessfulBackup,
          oldestBackup: retentionStatus.oldestSuccessfulBackup
        },
        totalSize: backupSizeInfo.totalSize,
        fileCount: backupSizeInfo.fileCount
      },
      count: formattedBackups.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error fetching backup list:`, errorMessage);
    res.status(500).json({ error: errorMessage, code: 'BACKUP_LIST_ERROR', timestamp: new Date().toISOString() });
  }
});

router.post('/backups/cleanup', requireAdmin, async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] POST /api/admin/backups/cleanup - Running FIFO cleanup`);
  
  try {
    console.log(`${LOG_PREFIX} Starting FIFO retention enforcement...`);
    const result = await backupRetentionService.enforceFIFORetention();
    
    const finalStatus = await backupRetentionService.getRetentionStatus();
    
    console.log(`${LOG_PREFIX} Cleanup completed in ${Date.now() - startTime}ms - Deleted ${result.deletedBackups} backups`);
    
    res.json({
      success: result.success,
      data: {
        deletedBackups: result.deletedBackups,
        deletedFiles: result.deletedFiles.length,
        keptBackups: result.keptBackups,
        retentionCount: BACKUP_RETENTION_COUNT,
        newTotalBackups: finalStatus.totalSuccessfulBackups,
        isCompliant: finalStatus.isCompliant,
        errors: result.errors
      },
      message: result.success 
        ? `Cleanup completed: ${result.deletedBackups} backups deleted. ${finalStatus.totalSuccessfulBackups}/${BACKUP_RETENTION_COUNT} backups remaining.`
        : `Cleanup completed with ${result.errors.length} errors`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error running cleanup:`, errorMessage);
    res.status(500).json({ success: false, error: errorMessage, code: 'CLEANUP_ERROR', timestamp: new Date().toISOString() });
  }
});

router.get('/backups/retention-status', requireAdmin, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] GET /api/admin/backups/retention-status - Fetching retention status`);
  
  try {
    const status = await backupRetentionService.getRetentionStatus();
    const sizeInfo = await backupRetentionService.getTotalBackupSize();
    
    console.log(`${LOG_PREFIX} Retention status fetched in ${Date.now() - startTime}ms`);
    res.json({
      success: true,
      data: {
        retentionPolicy: {
          count: BACKUP_RETENTION_COUNT,
          description: `${BACKUP_RETENTION_COUNT} backups (Auto-managed)`,
          type: 'FIFO'
        },
        current: {
          totalBackups: status.totalSuccessfulBackups,
          backupsToKeep: status.backupsToKeep,
          backupsToDelete: status.backupsToDelete,
          newestBackup: status.newestSuccessfulBackup,
          oldestBackup: status.oldestSuccessfulBackup
        },
        storage: {
          totalSize: sizeInfo.totalSize,
          fileCount: sizeInfo.fileCount
        },
        compliance: {
          isCompliant: status.isCompliant,
          status: status.isCompliant ? 'COMPLIANT' : 'NEEDS_CLEANUP',
          message: status.isCompliant 
            ? `All ${status.totalSuccessfulBackups} backups are within the retention policy of ${BACKUP_RETENTION_COUNT}`
            : `${status.backupsToDelete} backups exceed the retention policy of ${BACKUP_RETENTION_COUNT}. Click "Cleanup Old Backups" to remove them.`
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error fetching retention status:`, errorMessage);
    res.status(500).json({ error: errorMessage, code: 'RETENTION_STATUS_ERROR', timestamp: new Date().toISOString() });
  }
});

router.post('/backups/manual', requireAdmin, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { force = false } = req.body;
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] POST /api/admin/backups/manual - Triggering manual backup (force=${force})`);
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const existingBackup = await backupService.checkDuplicateBackup(today);
    if (existingBackup && !force) {
      console.log(`${LOG_PREFIX} Backup already exists for today (${today}). Use force=true to override.`);
      res.status(409).json({
        success: false,
        error: 'Backup already exists for today',
        code: 'DUPLICATE_BACKUP',
        existing_backup: formatBackupHistoryEntry(existingBackup),
        force_hint: 'Send force=true to create a new backup anyway',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const backupLog = await backupService.createBackupLog('manual', ADMIN_EMAIL);
    console.log(`${LOG_PREFIX} Created backup log: ${backupLog.id}`);
    
    setImmediate(async () => {
      try {
        console.log(`${LOG_PREFIX} Starting backup process for log: ${backupLog.id}`);
        
        console.log(`${LOG_PREFIX} Exporting database...`);
        const { data: databaseExport, exportedBytes } = await backupService.exportDatabase();
        
        console.log(`${LOG_PREFIX} Collecting storage files...`);
        const { files: storageFiles, totalExpectedSize, bucketsFound } = await backupService.collectStorageFiles();
        const externalImages = await backupService.collectExternalImages();
        console.log(`${LOG_PREFIX} Found ${storageFiles.length} storage files across ${bucketsFound.length} buckets and ${externalImages.length} external images`);
        
        const archiveResult = await backupService.createBackupArchive(
          databaseExport,
          storageFiles,
          () => {}
        );
        
        const expectedFiles = ['database-export.json', ...archiveResult.filesInArchive.filter(f => f !== 'database-export.json')];
        const archiveValidation = await backupService.validateArchiveContents(archiveResult.archivePath, expectedFiles);
        
        const manifest = await backupService.createManifest(
          today,
          'manual',
          ADMIN_EMAIL,
          databaseExport,
          storageFiles,
          externalImages,
          archiveResult,
          archiveValidation
        );
        
        const fs = await import('fs');
        const manifestPath = archiveResult.archivePath.replace('.zip', '-manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        
        console.log(`${LOG_PREFIX} Uploading to Google Drive...`);
        const rootFolder = await googleDriveService.getOrCreateRootFolder();
        const datedFolder = await googleDriveService.createDatedFolder(rootFolder.id, today);
        
        const { google } = await import('googleapis');
        const auth = new google.auth.GoogleAuth({
          credentials: JSON.parse(fs.readFileSync(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH!, 'utf8')),
          scopes: ['https://www.googleapis.com/auth/drive.file']
        });
        const drive = google.drive({ version: 'v3', auth });
        
        const uploadFile = async (filePath: string, folderId: string, mimeType: string) => {
          const fileName = filePath.includes('manifest') ? 'backup-manifest.json' : `backup-${today}.zip`;
          await drive.files.create({
            requestBody: { name: fileName, parents: [folderId] },
            media: { body: fs.createReadStream(filePath) }
          });
        };
        
        await uploadFile(archiveResult.archivePath, datedFolder.id, 'application/zip');
        await uploadFile(manifestPath, datedFolder.id, 'application/json');
        console.log(`${LOG_PREFIX} Upload completed`);
        
        console.log(`${LOG_PREFIX} Enforcing retention policy (FIFO - keep latest ${BACKUP_RETENTION_COUNT})...`);
        const retentionResult = await backupRetentionService.enforceFIFORetention();
        
        console.log(`${LOG_PREFIX} Cleaning up temporary files...`);
        await backupService.cleanupTempFiles(archiveResult.archivePath, manifestPath);
        
        const backupSize = fs.statSync(archiveResult.archivePath).size;
        
        const adminCompletenessMessage = manifest.completeness === 'fully_restorable' 
          ? 'Fully Restorable' 
          : manifest.completeness === 'partially_restorable' 
            ? `Partially Restorable (${manifest.storage.total_files_missing} files missing)`
            : 'DB Only';

        await backupService.updateBackupLog(backupLog.id, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          file_count: archiveResult.filesIncluded + 2,
          backup_size: backupSize + fs.statSync(manifestPath).size,
          drive_folder_id: datedFolder.id,
          retention_deleted: retentionResult.deletedBackups,
          error_message: `[${manifest.completeness}] ${adminCompletenessMessage} | Files: ${manifest.storage.total_files_included}/${manifest.storage.total_files_expected} | Size: ${manifest.storage.total_included_size} bytes | Buckets: ${manifest.storage.buckets.map(b => `${b.bucket_name}(${b.files_included}/${b.files_expected})`).join(', ')}`
        });
        
        console.log(`${LOG_PREFIX} Manual backup completed successfully in ${Date.now() - startTime}ms - Log: ${backupLog.id}, Size: ${backupSize}, completeness: ${manifest.completeness}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`${LOG_PREFIX} Backup failed for log ${backupLog.id}:`, errorMessage);
        await backupService.updateBackupLog(backupLog.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage
        });
      }
    });
    
    res.json({
      success: true,
      data: {
        backupLogId: backupLog.id,
        backupType: 'manual',
        backupDate: today,
        force,
        status: 'in_progress'
      },
      message: 'Backup started successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error triggering manual backup:`, errorMessage);
    res.status(500).json({ success: false, error: errorMessage, code: 'TRIGGER_BACKUP_ERROR', timestamp: new Date().toISOString() });
  }
});

router.get('/health', requireAdmin, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] GET /api/admin/health - Running health check`);
  
  try {
    const supabase = getSupabase();
    const errors: string[] = [];
    
    const { error: dbError } = await supabase.from('persons').select('id', { count: 'exact', head: true });
    if (dbError) {
      errors.push(`Supabase: ${dbError.message}`);
    }
    
    let googleDriveConnected = false;
    try {
      await googleDriveService.getOrCreateRootFolder();
      googleDriveConnected = true;
    } catch (driveError) {
      errors.push(`Google Drive: ${driveError instanceof Error ? driveError.message : 'Connection failed'}`);
    }
    
    const health = {
      supabaseConnected: !dbError,
      googleDriveConnected,
      lastHealthCheck: new Date().toISOString(),
      errors,
      responseTimeMs: Date.now() - startTime
    };
    
    console.log(`${LOG_PREFIX} Health check completed in ${Date.now() - startTime}ms - Supabase: ${health.supabaseConnected}, Drive: ${health.googleDriveConnected}`);
    
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error running health check:`, errorMessage);
    res.status(500).json({ 
      success: false,
      data: {
        supabaseConnected: false,
        googleDriveConnected: false,
        lastHealthCheck: new Date().toISOString(),
        errors: [errorMessage],
        responseTimeMs: Date.now() - startTime
      },
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/dashboard', requireAdmin, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] GET /api/admin/dashboard - Fetching dashboard summary`);
  
  try {
    const supabase = getSupabase();
    
    let profileAssetCount = 0;
    let profileAssetBytes = 0;
    let dbRecordCount = 0;
    let usedBytes = 0;
    
    const { files, totalExpectedSize } = await backupService.collectStorageFiles();
    profileAssetCount = files.length;
    profileAssetBytes = totalExpectedSize;
    usedBytes += profileAssetBytes;
    
    const tables = ['persons', 'client_profiles', 'payments', 'subscriptions', 'notifications', 'messages'];
    for (const table of tables) {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      dbRecordCount += count || 0;
    }
    
    const estimatedDbBytes = dbRecordCount * 2048;
    usedBytes += estimatedDbBytes;
    
    const estimatedTotalBytes = 5368709120;
    const usagePercent = Math.min(100, (usedBytes / estimatedTotalBytes) * 100);
    
    const storage: StorageSummary = {
      usedBytes,
      remainingBytes: Math.max(0, estimatedTotalBytes - usedBytes),
      totalBytes: estimatedTotalBytes,
      usagePercent: Math.round(usagePercent * 100) / 100,
      status: calculateStatus(usagePercent),
      warningLevel: calculateWarningLevel(usagePercent),
      profileAssetCount,
      profileAssetBytes,
      dbRecordCount,
      lastUpdated: new Date().toISOString()
    };
    
    const { data: backups } = await supabase
      .from('backup_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(BACKUP_RETENTION_COUNT);
    
    const completedBackups = (backups || []).filter(b => b.status === 'completed');
    const lastBackup = completedBackups[0] || null;
    
    const retentionStatus = await backupRetentionService.getRetentionStatus();
    
    const backup: BackupSummary = {
      backupCount: completedBackups.length,
      backupTotalBytes: completedBackups.reduce((sum, b) => sum + (b.backup_size || 0), 0),
      lastBackupAt: lastBackup?.completed_at || null,
      lastBackupSize: lastBackup?.backup_size || null,
      lastBackupStatus: lastBackup?.status || null,
      nextScheduledBackupAt: getNextScheduledBackup(),
      retentionPolicyDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '7'),
      retentionMaxCount: BACKUP_RETENTION_COUNT,
      oldestBackupAt: completedBackups[completedBackups.length - 1]?.completed_at || null,
      newestBackupAt: lastBackup?.completed_at || null
    };
    
    const response: AdminDashboardSummary = { storage, backup };
    
    console.log(`${LOG_PREFIX} Dashboard fetched in ${Date.now() - startTime}ms`);
    res.json({
      success: true,
      data: {
        ...response,
        retention: {
          policy: `${BACKUP_RETENTION_COUNT} backups (Auto-managed)`,
          isCompliant: retentionStatus.isCompliant,
          backupsToDelete: retentionStatus.backupsToDelete
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Error fetching dashboard:`, errorMessage);
    res.status(500).json({ success: false, error: errorMessage, code: 'DASHBOARD_ERROR', timestamp: new Date().toISOString() });
  }
});

export default router;