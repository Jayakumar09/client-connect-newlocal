import 'dotenv/config';
import { googleDriveBackupService } from '../services/google-drive-backup-service.js';
import { BackupProgress } from '../types/index.js';

async function main() {
  console.log('=== Google Drive Backup Script ===');
  console.log(`Started at: ${new Date().toISOString()}`);

  const progressCallback = (progress: BackupProgress) => {
    console.log(`[Progress] ${progress.progress}% - ${progress.stage}: ${progress.message}`);
    if (progress.error) {
      console.error(`[Error] ${progress.error}`);
    }
  };

  try {
    const result = await googleDriveBackupService.executeBackup(progressCallback);

    if (result.success) {
      console.log('\n=== Backup Successful ===');
      console.log(`Backup Date: ${result.backupDate}`);
      console.log(`Drive File ID: ${result.driveFileId}`);
      console.log(`Drive File Name: ${result.driveFileName}`);
      console.log(`Drive File Size: ${result.driveFileSize} bytes`);
      console.log(`Database Size: ${result.databaseExportedBytes} bytes`);
      console.log(`Storage Size: ${result.storageExportedBytes} bytes`);
      console.log(`Files Processed: ${result.filesProcessed}`);
      console.log(`Uploaded At: ${result.uploadedAt}`);
      process.exit(0);
    } else {
      console.error('\n=== Backup Failed ===');
      console.error(`Error: ${result.error}`);
      console.error(`Archive preserved at: ${result.archivePath}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n=== Backup Error ===');
    console.error(error);
    process.exit(1);
  }
}

main();