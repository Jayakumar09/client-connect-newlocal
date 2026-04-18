#!/usr/bin/env node

import 'dotenv/config';
import { backupRetentionService } from '../services/backupRetentionService.js';

const BACKUP_RETENTION_COUNT = parseInt(process.env.BACKUP_RETENTION_COUNT || '7');

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h')
  };
}

function printHelp() {
  console.log(`
BACKUP RETENTION CLEANUP JOB
============================

Usage: npm run backup:retention-cleanup [--options]

Options:
  --dry-run, -n    Show what would be deleted without actually deleting
  --verbose, -v    Show detailed output
  --help, -h      Show this help

Environment Variables:
  BACKUP_RETENTION_COUNT     Number of backups to keep (default: 7)
  GOOGLE_DRIVE_FOLDER_ID      Root backup folder ID in Google Drive
  GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH  Path to service account credentials

Examples:
  npm run backup:retention-cleanup
  npm run backup:retention-cleanup -- --dry-run
  `);
}

async function main() {
  const options = parseArgs();
  
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log('\n' + '='.repeat(60));
  console.log('BACKUP RETENTION CLEANUP JOB');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Retention Policy: Keep latest ${BACKUP_RETENTION_COUNT} successful backups`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no deletions)' : 'LIVE'}`);
  console.log('='.repeat(60) + '\n');

  try {
    console.log('[Cleanup] Getting retention status...');
    const status = await backupRetentionService.getRetentionStatus();
    
    console.log('\n[Cleanup] Current Status:');
    console.log(`  Successful Backups in DB: ${status.totalSuccessfulBackups}`);
    console.log(`  Backup Folders in Drive: ${status.totalBackupsInDrive}`);
    console.log(`  Retention Count: ${status.retentionCount}`);
    console.log(`  Backups to Keep: ${status.backupsToKeep}`);
    console.log(`  Backups to Delete: ${status.backupsToDelete}`);
    console.log(`  Newest Backup: ${status.newestSuccessfulBackup || 'N/A'}`);
    console.log(`  Oldest Backup: ${status.oldestSuccessfulBackup || 'N/A'}`);
    console.log(`  Compliant: ${status.isCompliant ? 'YES ✓' : 'NO ✗'}`);

    if (status.isCompliant) {
      console.log('\n[Cleanup] ✓ No cleanup needed. All backups within retention policy.\n');
      process.exit(0);
    }

    if (options.verbose) {
      const successfulBackups = await backupRetentionService.getSuccessfulBackups();
      const sorted = successfulBackups
        .filter(b => b.drive_folder_id)
        .sort((a, b) => {
          const timeA = a.completed_at || a.created_at;
          const timeB = b.completed_at || b.created_at;
          return new Date(timeB).getTime() - new Date(timeA).getTime();
        });

      console.log('\n[Cleanup] All successful backups (sorted by time):');
      sorted.forEach((backup, i) => {
        const willDelete = i >= BACKUP_RETENTION_COUNT;
        const mark = willDelete ? '✗' : '✓';
        console.log(`  ${mark} ${backup.backup_date} - ${backup.drive_folder_name || backup.drive_folder_id} (${backup.completed_at || backup.created_at})`);
      });
    }

    console.log('\n[Cleanup] Starting FIFO cleanup...');
    const result = await backupRetentionService.enforceFIFORetention({ dryRun: options.dryRun });

    console.log('\n' + '='.repeat(60));
    console.log('CLEANUP RESULT');
    console.log('='.repeat(60));
    console.log(`  Success: ${result.success ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  Mode: ${result.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`  Kept Backups: ${result.keptBackups}`);
    console.log(`  Deleted Backups: ${result.deletedBackups}`);
    console.log(`  Deleted Files: ${result.deletedFiles.length}`);
    
    if (result.deletedFiles.length > 0 && options.verbose) {
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

    const finalStatus = await backupRetentionService.getRetentionStatus();
    console.log('\n  After Cleanup:');
    console.log(`    Total Backups: ${finalStatus.totalSuccessfulBackups}`);
    console.log(`    Compliant: ${finalStatus.isCompliant ? 'YES ✓' : 'NO ✗'}`);

    console.log(`\nCompleted: ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    if (!result.success) {
      process.exit(1);
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    if (errorMsg.includes('not configured') || errorMsg.includes('GOOGLE_DRIVE')) {
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
