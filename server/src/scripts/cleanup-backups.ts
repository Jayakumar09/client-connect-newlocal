#!/usr/bin/env node

import 'dotenv/config';
import { backupRetentionService } from '../services/backupRetentionService.js';

const BACKUP_RETENTION_COUNT = parseInt(process.env.BACKUP_RETENTION_COUNT || '7');

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('BACKUP RETENTION CLEANUP JOB');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Retention Policy: Keep latest ${BACKUP_RETENTION_COUNT} backups`);
  console.log('='.repeat(60) + '\n');

  try {
    console.log('[Cleanup] Getting retention status...');
    const status = await backupRetentionService.getRetentionStatus();
    
    console.log('\n[Cleanup] Current Status:');
    console.log(`  Total Backups: ${status.totalBackups}`);
    console.log(`  Retention Count: ${status.retentionCount}`);
    console.log(`  Backups to Keep: ${status.backupsToKeep}`);
    console.log(`  Backups to Delete: ${status.backupsToDelete}`);
    console.log(`  Oldest Backup: ${status.oldestBackup || 'N/A'}`);
    console.log(`  Newest Backup: ${status.newestBackup || 'N/A'}`);
    console.log(`  Compliant: ${status.isCompliant ? 'YES ✓' : 'NO ✗'}`);

    if (status.isCompliant) {
      console.log('\n[Cleanup] ✓ No cleanup needed. All backups within retention policy.\n');
      process.exit(0);
    }

    console.log('\n[Cleanup] Starting FIFO cleanup...');
    const result = await backupRetentionService.enforceFIFORetention();

    console.log('\n' + '='.repeat(60));
    console.log('CLEANUP RESULT');
    console.log('='.repeat(60));
    console.log(`  Success: ${result.success ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  Kept Backups: ${result.keptBackups}`);
    console.log(`  Deleted Backups: ${result.deletedBackups}`);
    console.log(`  Deleted Files: ${result.deletedFiles.length}`);
    
    if (result.deletedFiles.length > 0) {
      console.log('\n  Deleted Files:');
      for (const file of result.deletedFiles) {
        console.log(`    - ${file.name} (${formatBytes(file.size)})`);
      }
    }
    
    if (result.errors.length > 0) {
      console.log('\n  Errors:');
      for (const error of result.errors) {
        console.log(`    - ${error}`);
      }
    }

    console.log(`\nCompleted: ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    if (!result.success) {
      process.exit(1);
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    if (errorMsg.includes('not configured')) {
      console.log('\n[Cleanup] Google Drive not configured. Skipping cleanup.');
      console.log('[Cleanup] Configure GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH to enable backup retention.');
      process.exit(0);
    }
    console.error('\n[Cleanup] Fatal error:', errorMsg);
    process.exit(1);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

main();
