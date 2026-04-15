#!/usr/bin/env node

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { BackupService } from '../src/services/backupService.js';
import { verifyZipArchive } from '../src/utils/zip.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    verify: false,
    backupFile: null,
    skipStorage: false,
    skipSqlDump: false,
    outputDir: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--verify':
      case '-v':
        options.verify = true;
        break;
      case '--skip-storage':
        options.skipStorage = true;
        break;
      case '--skip-sql':
        options.skipSqlDump = true;
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('--')) {
          options.backupFile = arg;
        }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Backup System - CLI

Usage: node runBackup.js [options] [backup-file]

Options:
  --verify, -v         Verify an existing backup ZIP
  --skip-storage       Skip storage file backup
  --skip-sql           Skip SQL dump (JSON only)
  --output <dir>       Output directory for backup
  --help, -h           Show this help

Examples:
  node runBackup.js                        Create new backup
  node runBackup.js --skip-storage         Create database-only backup
  node runBackup.js --verify backup.zip    Verify existing backup
  `);
}

async function runBackup(options) {
  console.log('\n' + '='.repeat(60));
  console.log('BACKUP SYSTEM v3.0.0');
  console.log('='.repeat(60) + '\n');

  const config = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    TEMP_BACKUP_DIR: process.env.TEMP_BACKUP_DIR || './temp/backup',
    BACKUP_OUTPUT_DIR: options.outputDir || process.env.BACKUP_OUTPUT_DIR || './backups',
    PG_DUMP_PATH: process.env.PG_DUMP_PATH,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'cli@system'
  };

  const backupService = new BackupService(config);

  if (options.verify && options.backupFile) {
    console.log(`[CLI] Verifying backup: ${options.backupFile}\n`);
    
    const result = await backupService.verifyBackup(options.backupFile);
    
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION RESULT');
    console.log('='.repeat(60));
    console.log(`  Valid: ${result.valid}`);
    console.log(`  Errors: ${result.errors.length > 0 ? result.errors.join(', ') : 'None'}`);
    console.log(`  Warnings: ${result.warnings.length > 0 ? result.warnings.join(', ') : 'None'}`);
    
    if (result.manifest) {
      console.log('\n  Manifest:');
      console.log(`    Backup Date: ${result.manifest.backup_date}`);
      console.log(`    Completeness: ${result.manifest.completeness}`);
      console.log(`    Full Restorable: ${result.manifest.is_full_restorable}`);
      console.log(`    Database: ${result.manifest.database?.tables?.length || 0} tables, ${result.manifest.database?.total_records || 0} records`);
      console.log(`    Storage: ${result.manifest.storage?.total_files_included || 0}/${result.manifest.storage?.total_files_expected || 0} files`);
    }
    console.log('='.repeat(60) + '\n');
    
    process.exit(result.valid ? 0 : 1);
  }

  console.log('[CLI] Configuration:');
  console.log(`  Supabase: ${config.VITE_SUPABASE_URL ? 'Yes' : 'No'}`);
  console.log(`  Database URL: ${config.DATABASE_URL ? 'Yes' : 'No'}`);
  console.log(`  Temp Dir: ${config.TEMP_BACKUP_DIR}`);
  console.log(`  Output Dir: ${config.BACKUP_OUTPUT_DIR}\n`);

  const result = await backupService.runFullBackup({
    backupType: 'manual',
    includeSqlDump: !options.skipSqlDump,
    includeJsonExport: true,
    includeStorage: !options.skipStorage,
    cleanupAfter: true
  });

  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULT');
  console.log('='.repeat(60));
  console.log(`  Success: ${result.success}`);
  console.log(`  Completeness: ${result.completeness}`);
  console.log(`  Full Restorable: ${result.isFullRestorable}`);
  console.log(`  Output: ${result.archive?.filePath || 'N/A'}`);
  console.log(`  Size: ${result.archive?.size || 0} bytes`);
  
  if (result.warnings.length > 0) {
    console.log('\n  Warnings:');
    result.warnings.forEach(w => console.log(`    - ${w}`));
  }
  
  if (result.errors.length > 0) {
    console.log('\n  Errors:');
    result.errors.forEach(e => console.log(`    - ${e}`));
  }
  console.log('='.repeat(60) + '\n');

  process.exit(result.success ? 0 : 1);
}

const options = parseArgs();
runBackup(options).catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});