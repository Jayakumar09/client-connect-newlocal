import cron from 'node-cron';
import dotenv from 'dotenv';
import { backupService, ArchiveResult } from '../services/backup-service.js';
import { googleDriveService } from '../services/google-drive-service.js';

dotenv.config();

const ADMIN_EMAIL = 'vijayalakshmijayakumar45@gmail.com';
const LOG_PREFIX = '[Scheduler]';

async function runAutomaticBackup() {
  console.log(`[${new Date().toISOString()}] ${LOG_PREFIX} Starting automatic daily backup...`);

  const today = new Date().toISOString().split('T')[0];
  let backupLogId = '';
  
  const fs = await import('fs');

  let archivePath: string | undefined = undefined;
  let manifestPath: string | undefined = undefined;
  let archiveUploadSize = 0;
  let manifestUploadSize = 0;
  let driveFolderId: string | undefined = undefined;
  let uploadCompleted = false;
  let retentionDeleted = 0;
  let archiveResult: ArchiveResult | null = null;

  const safeCleanup = () => {
    const filesToCleanup: string[] = [];
    if (archivePath && typeof archivePath === 'string' && archivePath.length > 0) {
      filesToCleanup.push(archivePath);
    }
    if (manifestPath && typeof manifestPath === 'string' && manifestPath.length > 0) {
      filesToCleanup.push(manifestPath);
    }
    
    for (const filePath of filesToCleanup) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`${LOG_PREFIX} Cleaned up temp file: ${filePath}`);
        }
      } catch (cleanupError) {
        console.warn(`${LOG_PREFIX} Could not delete temp file ${filePath}:`, cleanupError instanceof Error ? cleanupError.message : 'Unknown');
      }
    }
  };

  try {
    const existingBackup = await backupService.checkDuplicateBackup(today);
    if (existingBackup) {
      console.log(`${LOG_PREFIX} Backup already exists for today (${today}). Skipping.`);
      return;
    }

    const backupLog = await backupService.createBackupLog('automatic', ADMIN_EMAIL);
    backupLogId = backupLog.id;
    console.log(`${LOG_PREFIX} Created backup log: ${backupLogId}`);

    try {
      console.log(`${LOG_PREFIX} Exporting database...`);
      const { data: databaseExport, exportedBytes } = await backupService.exportDatabase();
      const tableCount = Object.keys(databaseExport).length;
      console.log(`${LOG_PREFIX} Database exported: ${tableCount} tables, ${exportedBytes} bytes`);

      console.log(`${LOG_PREFIX} Collecting storage files...`);
      const { files: storageFiles, totalExpectedSize } = await backupService.collectStorageFiles();
      console.log(`${LOG_PREFIX} Found ${storageFiles.length} storage files (${totalExpectedSize} bytes expected)`);

      const externalImages = await backupService.collectExternalImages();
      console.log(`${LOG_PREFIX} Found ${externalImages.length} external images`);

      console.log(`${LOG_PREFIX} Creating backup archive with actual file downloads...`);
      archiveResult = await backupService.createBackupArchive(
        databaseExport,
        storageFiles,
        () => {}
      );
      archivePath = archiveResult.archivePath;
      console.log(`${LOG_PREFIX} Archive created: ${archivePath}`);
      console.log(`${LOG_PREFIX} Storage backup: ${archiveResult.filesIncluded}/${archiveResult.filesProcessed} files, ${archiveResult.storageSize} bytes`);
      if (archiveResult.filesMissing.length > 0) {
        console.warn(`${LOG_PREFIX} Missing files: ${archiveResult.filesMissing.length}`);
      }

      const expectedFiles = ['database-export.json', ...archiveResult.filesInArchive.filter(f => f !== 'database-export.json')];
      const archiveValidation = await backupService.validateArchiveContents(archivePath, expectedFiles);

      const manifest = await backupService.createManifest(
        today,
        'automatic',
        ADMIN_EMAIL,
        databaseExport,
        storageFiles,
        externalImages,
        archiveResult,
        archiveValidation
      );

      const tempManifestPath = archivePath.replace('.zip', '-manifest.json');
      manifestPath = tempManifestPath;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`${LOG_PREFIX} Manifest created: ${manifestPath}`);

      console.log(`${LOG_PREFIX} Uploading to Google Drive...`);
      const rootFolder = await googleDriveService.getOrCreateRootFolder();
      console.log(`${LOG_PREFIX} Root folder: ${rootFolder.id}`);
      const datedFolder = await googleDriveService.createDatedFolder(rootFolder.id, today);
      console.log(`${LOG_PREFIX} Dated folder: ${datedFolder.id}`);
      driveFolderId = datedFolder.id;

      const archiveUploadResult = await googleDriveService.uploadFile(
        archivePath,
        datedFolder.id,
        `backup-${today}.zip`,
        'application/zip'
      );
      archiveUploadSize = archiveUploadResult.size;
      console.log(`${LOG_PREFIX} Archive uploaded to Drive: ${archiveUploadResult.id}, size: ${archiveUploadResult.size}`);

      const manifestUploadResult = await googleDriveService.uploadFile(
        manifestPath,
        datedFolder.id,
        'backup-manifest.json',
        'application/json'
      );
      manifestUploadSize = manifestUploadResult.size;
      console.log(`${LOG_PREFIX} Manifest uploaded to Drive: ${manifestUploadResult.id}, size: ${manifestUploadResult.size}`);

      const totalBackupSize = archiveUploadSize + manifestUploadSize;
      console.log(`${LOG_PREFIX} Total backup size (from Drive): ${totalBackupSize}`);
      
      uploadCompleted = true;

      console.log(`${LOG_PREFIX} Enforcing retention policy...`);
      try {
        retentionDeleted = await backupService.enforceRetentionPolicy(datedFolder.id);
        console.log(`${LOG_PREFIX} Retention policy enforced: ${retentionDeleted} old backups deleted`);
      } catch (retentionError) {
        console.warn(`${LOG_PREFIX} Retention policy enforcement failed (non-critical):`, retentionError instanceof Error ? retentionError.message : 'Unknown');
      }

      console.log(`${LOG_PREFIX} Cleaning up local temp files...`);
      safeCleanup();
      console.log(`${LOG_PREFIX} Local temp files cleaned up`);

      const schedulerCompletenessMessage = manifest.completeness === 'fully_restorable' 
        ? 'Fully Restorable' 
        : manifest.completeness === 'partially_restorable' 
          ? `Partially Restorable (${manifest.storage.total_files_missing} files missing)`
          : 'DB Only';

      await backupService.updateBackupLog(backupLogId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        file_count: (archiveResult?.filesIncluded || 0) + 2,
        backup_size: totalBackupSize,
        drive_folder_id: driveFolderId,
        retention_deleted: retentionDeleted,
        error_message: `[${manifest.completeness}] ${schedulerCompletenessMessage} | Files: ${manifest.storage.total_files_included}/${manifest.storage.total_files_expected} | Size: ${manifest.storage.total_included_size} bytes | Buckets: ${manifest.storage.buckets.map(b => `${b.bucket_name}(${b.files_included}/${b.files_expected})`).join(', ')}`
      });

      console.log(`${LOG_PREFIX} [${new Date().toISOString()}] Automatic backup completed successfully! Size: ${totalBackupSize}, Files: ${archiveResult?.filesIncluded || 0}/${archiveResult?.filesProcessed || 0}, completeness: ${manifest.completeness}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      console.error(`${LOG_PREFIX} Backup step failed: ${errorMessage}`);
      console.error(`${LOG_PREFIX} Error stack: ${errorStack}`);

      let finalStatus: 'completed' | 'failed' = 'failed';
      let finalErrorMessage = errorMessage;
      let finalBackupSize: number | null = null;
      let finalDriveFolderId: string | null = null;

      if (uploadCompleted) {
        finalStatus = 'completed';
        finalBackupSize = archiveUploadSize + manifestUploadSize;
        finalDriveFolderId = driveFolderId || null;
        finalErrorMessage = `Upload succeeded but cleanup/retention failed: ${errorMessage}`;
        console.warn(`${LOG_PREFIX} CRITICAL: Upload completed but cleanup failed. Marking as completed with size=${finalBackupSize}`);
      }

      await backupService.updateBackupLog(backupLogId, {
        status: finalStatus,
        completed_at: new Date().toISOString(),
        backup_size: finalBackupSize,
        drive_folder_id: finalDriveFolderId,
        error_message: finalErrorMessage
      });

      console.error(`${LOG_PREFIX} [${new Date().toISOString()}] Automatic backup ${finalStatus}. Error: ${finalErrorMessage}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} Failed to initialize backup: ${errorMessage}`);
    if (backupLogId) {
      await backupService.updateBackupLog(backupLogId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: `Initialization failed: ${errorMessage}`
      });
    }
  }
}

cron.schedule('0 2 * * *', () => {
  console.log(`${LOG_PREFIX} Running scheduled backup task...`);
  runAutomaticBackup();
}, {
  timezone: 'Asia/Kolkata'
});

console.log(`${LOG_PREFIX} Backup scheduler started. Daily backup scheduled for 2:00 AM IST.`);
console.log(`${LOG_PREFIX} Press Ctrl+C to stop.`);

runAutomaticBackup();
