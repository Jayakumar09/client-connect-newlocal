import { Router, Request, Response } from 'express';
import { backupService } from '../services/backup-service.js';
import { googleDriveService } from '../services/google-drive-service.js';
import { BackupProgress } from '../types/index.js';

const router = Router();

const ADMIN_EMAIL = 'vijayalakshmijayakumar45@gmail.com';

function requireAdmin(req: Request, res: Response, next: (err?: Error) => void): void {
  const apiKey = req.headers['x-admin-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.post('/trigger', requireAdmin, async (req: Request, res: Response) => {
  const { force = false } = req.body;
  const backupType: 'manual' | 'automatic' = 'manual';
  const today = new Date().toISOString().split('T')[0];

  try {
    const existingBackup = await backupService.checkDuplicateBackup(today);
    if (existingBackup && !force) {
      res.status(409).json({
        success: false,
        error: 'Backup already exists for today',
        code: 'DUPLICATE_BACKUP',
        existing_backup: existingBackup,
        force_hint: 'Send force=true to create a new backup anyway',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const backupLog = await backupService.createBackupLog(backupType, ADMIN_EMAIL);

    const sendProgress = (progress: BackupProgress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    };

    setImmediate(async () => {
      const fs = await import('fs');
      
      let archivePath: string | undefined = undefined;
      let archiveUploadSize = 0;
      let driveFolderId: string | undefined = undefined;
      let uploadCompleted = false;
      let retentionDeleted = 0;
      let archiveResult: import('../services/backup-service.js').ArchiveResult | null = null;

      const safeCleanup = async () => {
        const filesToCleanup: string[] = [];
        if (archivePath && typeof archivePath === 'string' && archivePath.length > 0) {
          filesToCleanup.push(archivePath);
        }
        
        for (const filePath of filesToCleanup) {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`[BackupRoutes] Cleaned up temp file: ${filePath}`);
            }
          } catch (cleanupError) {
            console.warn(`[BackupRoutes] Could not delete temp file ${filePath}:`, cleanupError instanceof Error ? cleanupError.message : 'Unknown');
          }
        }
      };

      try {
        sendProgress({ stage: 'initializing', progress: 5, message: 'Starting backup process...' });
        console.log(`[BackupRoutes] [${new Date().toISOString()}] Backup started: ${backupLog.id}, type=${backupType}, force=${force}`);

        sendProgress({ stage: 'exporting_database', progress: 10, message: 'Exporting database...' });
        console.log(`[BackupRoutes] Exporting database...`);
        const { data: databaseExport, exportedBytes } = await backupService.exportDatabase();
        const tableCount = Object.keys(databaseExport).length;
        console.log(`[BackupRoutes] Database exported: ${tableCount} tables, ${exportedBytes} bytes`);
        sendProgress({ stage: 'exporting_database', progress: 25, message: `Database exported: ${tableCount} tables (${exportedBytes} bytes)` });

        sendProgress({ stage: 'collecting_files', progress: 30, message: 'Collecting storage files from all buckets...' });
        console.log(`[BackupRoutes] Collecting storage files from all buckets...`);
        const { files: storageFiles, totalExpectedSize, bucketsFound } = await backupService.collectStorageFiles();
        const externalImages = await backupService.collectExternalImages();
        console.log(`[BackupRoutes] Found ${storageFiles.length} storage files across ${bucketsFound.length} buckets (${totalExpectedSize} bytes) and ${externalImages.length} external images`);
        sendProgress({ stage: 'collecting_files', progress: 45, message: `Found ${storageFiles.length} storage files across ${bucketsFound.length} buckets (${totalExpectedSize} bytes) and ${externalImages.length} external images` });

        sendProgress({ stage: 'creating_archive', progress: 50, message: 'Creating backup archive with storage files...' });
        console.log(`[BackupRoutes] Creating backup archive with storage files...`);
        
        archiveResult = await backupService.createBackupArchive(
          databaseExport,
          storageFiles,
          sendProgress,
          undefined,
          undefined
        );
        archivePath = archiveResult.archivePath;
        console.log(`[BackupRoutes] Archive created: ${archivePath}`);
        console.log(`[BackupRoutes] Storage backup: ${archiveResult.filesIncluded}/${archiveResult.filesProcessed} files, ${archiveResult.storageSize} bytes across ${archiveResult.bucketResults.length} buckets`);

        sendProgress({ stage: 'creating_archive', progress: 65, message: 'Validating archive contents...' });
        console.log(`[BackupRoutes] Validating archive contents...`);
        
        const expectedFiles = [
          'database-export.json',
          'backup-manifest.json',
          'RESTORE_README.md',
          ...archiveResult.filesInArchive.filter(f => f !== 'database-export.json')
        ];
        const archiveValidation = await backupService.validateArchiveContents(archivePath, expectedFiles);
        console.log(`[BackupRoutes] Archive validation: is_valid=${archiveValidation.is_valid}, is_complete=${archiveValidation.is_complete}, files_in_archive=${archiveValidation.files_in_archive.length}`);

        const manifest = await backupService.createManifest(
          today,
          backupType,
          ADMIN_EMAIL,
          databaseExport,
          storageFiles,
          externalImages,
          archiveResult,
          archiveValidation
        );

        const readmeContent = backupService.generateRestoreReadme(manifest);
        console.log(`[BackupRoutes] README generated with actual manifest data`);
        
        try {
          archivePath = await backupService.injectManifestIntoArchive(archivePath, manifest, readmeContent);
          console.log(`[BackupRoutes] Archive updated with accurate manifest embedded inside`);
        } catch (injectError) {
          console.warn(`[BackupRoutes] Could not inject manifest into archive:`, injectError instanceof Error ? injectError.message : 'Unknown');
        }

        sendProgress({ stage: 'uploading', progress: 70, message: 'Uploading to Google Drive...' });
        console.log(`[BackupRoutes] Uploading to Google Drive...`);

        const rootFolder = await googleDriveService.getOrCreateRootFolder();
        console.log(`[BackupRoutes] Root folder: ${rootFolder.id}`);
        const datedFolder = await googleDriveService.createDatedFolder(rootFolder.id, today);
        console.log(`[BackupRoutes] Dated folder: ${datedFolder.id}`);
        driveFolderId = datedFolder.id;

        const archiveUploadResult = await googleDriveService.uploadFile(
          archivePath,
          datedFolder.id,
          `backup-${today}.zip`,
          'application/zip'
        );
        archiveUploadSize = archiveUploadResult.size;
        console.log(`[BackupRoutes] Archive uploaded to Drive: ${archiveUploadResult.id}, size: ${archiveUploadResult.size} (self-contained: database+storage+manifest+README)`);

        const totalBackupSize = archiveUploadSize;
        console.log(`[BackupRoutes] Total backup size (from Drive): ${totalBackupSize}`);
        
        uploadCompleted = true;

        sendProgress({ stage: 'cleaning_up', progress: 95, message: 'Upload complete. Enforcing retention policy...' });
        console.log(`[BackupRoutes] Enforcing retention policy...`);
        
        try {
          retentionDeleted = await backupService.enforceRetentionPolicy(datedFolder.id);
          console.log(`[BackupRoutes] Retention policy enforced: ${retentionDeleted} old backups deleted`);
        } catch (retentionError) {
          console.warn(`[BackupRoutes] Retention policy enforcement failed (non-critical):`, retentionError instanceof Error ? retentionError.message : 'Unknown');
        }

        sendProgress({ stage: 'cleaning_up', progress: 97, message: 'Cleaning up local temporary files...' });
        console.log(`[BackupRoutes] Cleaning up local temp files...`);
        await safeCleanup();
        console.log(`[BackupRoutes] Local temp files cleaned up`);

        const completenessMessage = manifest.completeness === 'fully_restorable' 
          ? 'Fully Restorable' 
          : manifest.completeness === 'partially_restorable' 
            ? `Partially Restorable (${manifest.storage.total_files_missing} files missing)`
            : 'DB Only';

        await backupService.updateBackupLog(backupLog.id, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          file_count: archiveResult ? archiveResult.filesIncluded + 2 : 2,
          backup_size: totalBackupSize,
          drive_folder_id: driveFolderId,
          retention_deleted: retentionDeleted,
          error_message: `[${manifest.completeness}] ${completenessMessage} | Files: ${manifest.storage.total_files_included}/${manifest.storage.total_files_expected} | Size: ${manifest.storage.total_included_size} bytes | Buckets: ${manifest.storage.buckets.map(b => `${b.bucket_name}(${b.files_included}/${b.files_expected})`).join(', ')}`
        });
        console.log(`[BackupRoutes] Backup log updated: status=completed, size=${totalBackupSize}, completeness=${manifest.completeness}`);

        sendProgress({ stage: 'completed', progress: 100, message: `Backup completed! ${completenessMessage}` });
        console.log(`[BackupRoutes] [${new Date().toISOString()}] Backup ${backupLog.id} completed successfully!`);
        res.end();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`[BackupRoutes] Backup ${backupLog.id} failed: ${errorMessage}`);
        console.error(`[BackupRoutes] Error stack: ${errorStack}`);

        let finalStatus: 'completed' | 'failed' = 'failed';
        let finalErrorMessage = errorMessage;
        let finalBackupSize: number | null = null;
        let finalDriveFolderId: string | null = null;

        if (uploadCompleted) {
          finalStatus = 'completed';
          finalBackupSize = archiveUploadSize;
          finalDriveFolderId = driveFolderId || null;
          finalErrorMessage = `Upload succeeded but cleanup/retention failed: ${errorMessage}`;
          console.warn(`[BackupRoutes] CRITICAL: Upload completed but cleanup failed. Marking as completed with size=${finalBackupSize}`);
        }

        await backupService.updateBackupLog(backupLog.id, {
          status: finalStatus,
          completed_at: new Date().toISOString(),
          backup_size: finalBackupSize,
          drive_folder_id: finalDriveFolderId,
          error_message: finalErrorMessage
        });

        if (uploadCompleted) {
          sendProgress({ 
            stage: 'completed', 
            progress: 100, 
            message: 'Backup completed successfully (upload verified)!',
            error: finalErrorMessage 
          });
        } else {
          sendProgress({ 
            stage: 'failed', 
            progress: 0, 
            message: `Backup failed: ${finalErrorMessage}`, 
            error: finalErrorMessage 
          });
        }
        res.end();
      }
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[BackupRoutes] Failed to initialize backup: ${errorMessage}`);
    res.status(500).json({ success: false, error: errorMessage, code: 'INIT_ERROR', timestamp: new Date().toISOString() });
  }
});

router.get('/status', requireAdmin, async (_req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`[BackupRoutes] [${new Date().toISOString()}] GET /api/backup/status`);
  
  try {
    const recentBackups = await backupService.getRecentBackups(10);
    const lastBackup = recentBackups?.[0] || null;

    const nextScheduledBackup = new Date();
    nextScheduledBackup.setDate(nextScheduledBackup.getDate() + 1);
    nextScheduledBackup.setHours(2, 0, 0, 0);

    let totalSize = 0;
    try {
      const rootFolder = await googleDriveService.getOrCreateRootFolder();
      totalSize = await googleDriveService.getBackupSize(rootFolder.id);
    } catch (driveError) {
      console.warn(`[BackupRoutes] Could not fetch Drive size: ${driveError instanceof Error ? driveError.message : 'Unknown'}`);
    }

    res.json({
      success: true,
      isRunning: lastBackup?.status === 'in_progress',
      lastBackup,
      lastBackupAt: lastBackup?.completed_at || lastBackup?.started_at || null,
      lastBackupSize: lastBackup?.backup_size || null,
      lastBackupStatus: lastBackup?.status || null,
      nextScheduledBackup: nextScheduledBackup.toISOString(),
      totalBackupSize: totalSize,
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '7'),
      recentBackups,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[BackupRoutes] Status check failed: ${errorMessage}`);
    res.status(500).json({ success: false, error: errorMessage, timestamp: new Date().toISOString() });
  }
});

router.get('/logs', requireAdmin, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  console.log(`[BackupRoutes] [${new Date().toISOString()}] GET /api/backup/logs?limit=${limit}`);
  
  try {
    const logs = await backupService.getBackupLogs(limit);
    res.json({
      success: true,
      data: logs,
      count: logs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[BackupRoutes] Failed to fetch logs: ${errorMessage}`);
    res.status(500).json({ success: false, error: errorMessage, timestamp: new Date().toISOString() });
  }
});

router.post('/cleanup', requireAdmin, async (req: Request, res: Response) => {
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '7');
  console.log(`[BackupRoutes] [${new Date().toISOString()}] POST /api/backup/cleanup (retentionDays=${retentionDays})`);
  
  try {
    const rootFolder = await googleDriveService.getOrCreateRootFolder();
    const deletedCount = await googleDriveService.deleteOldBackups(rootFolder.id, retentionDays);
    console.log(`[BackupRoutes] Cleanup completed: ${deletedCount} backups deleted`);
    
    res.json({
      success: true,
      data: {
        deletedCount,
        retentionDays,
        rootFolderId: rootFolder.id
      },
      message: `Deleted ${deletedCount} old backups`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[BackupRoutes] Cleanup failed: ${errorMessage}`);
    res.status(500).json({ success: false, error: errorMessage, code: 'CLEANUP_ERROR', timestamp: new Date().toISOString() });
  }
});

export default router;
