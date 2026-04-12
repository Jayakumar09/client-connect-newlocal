#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { restoreService, RestoreOptions, RestoreReport } from '../services/restore-service.js';
import { googleDriveService } from '../services/google-drive-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

interface CLIArgs {
  '--help'?: boolean;
  '--file'?: string;
  '--backup-date'?: string;
  '--manifest'?: string;
  '--dry-run'?: boolean;
  '--mode'?: 'upsert' | 'insert' | 'replace';
  '--backup-first'?: boolean;
  '--bucket'?: string;
  '--buckets'?: string[];
  '--skip-existing'?: boolean;
  '--output-dir'?: string;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args['--help'] = true;
    } else if (arg === '--file' || arg === '-f') {
      args['--file'] = argv[++i];
    } else if (arg === '--backup-date' || arg === '-d') {
      args['--backup-date'] = argv[++i];
    } else if (arg === '--manifest' || arg === '-M') {
      args['--manifest'] = argv[++i];
    } else if (arg === '--dry-run' || arg === '--dryrun') {
      args['--dry-run'] = true;
    } else if (arg === '--mode' || arg === '-m') {
      const mode = argv[++i] as 'upsert' | 'insert' | 'replace';
      if (!['upsert', 'insert', 'replace'].includes(mode)) {
        console.error(`Invalid mode: ${mode}. Must be one of: upsert, insert, replace`);
        process.exit(1);
      }
      args['--mode'] = mode;
    } else if (arg === '--backup-first') {
      args['--backup-first'] = true;
    } else if (arg === '--bucket') {
      args['--bucket'] = argv[++i];
    } else if (arg === '--buckets') {
      args['--buckets'] = argv[++i].split(',');
    } else if (arg === '--skip-existing') {
      args['--skip-existing'] = true;
    } else if (arg === '--output-dir' || arg === '-o') {
      args['--output-dir'] = argv[++i];
    } else if (arg.startsWith('--')) {
      console.warn(`Unknown option: ${arg}`);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
BACKUP RESTORE TOOL
===================

Restore backups from local ZIP files or Google Drive.

USAGE:
  npm run restore:local -- [options]    Restore from local ZIP
  npm run restore:drive -- [options]    Restore from Google Drive

OPTIONS:
  --file, -f <path>           Path to local backup ZIP file
  --backup-date, -d <date>    Backup date (YYYY-MM-DD) for Drive restore
  --manifest, -M <path>       Path to external manifest JSON (optional)
  --dry-run                   Validate without making changes
  --mode, -m <mode>           Database restore mode:
                              - upsert: Insert new, update existing (DEFAULT)
                              - insert: Only insert new records
                              - replace: Delete all then re-insert (DANGEROUS)
  --backup-first              Create backup before restore (recommended)
  --bucket <name>             Restore specific bucket only
  --buckets <names>           Restore specific buckets (comma-separated)
  --skip-existing             Skip files that already exist in storage
  --output-dir, -o <path>     Output directory for downloaded backup
  --help, -h                 Show this help message

EXAMPLES:
  # Restore from local ZIP (dry run)
  npm run restore:local -- --file ./backup-2026-04-12.zip --dry-run

  # Restore database from ZIP
  npm run restore:local -- --file ./backup-2026-04-12.zip

  # Restore from Google Drive
  npm run restore:drive -- --backup-date 2026-04-12

  # Restore with replacement mode (DANGEROUS)
  npm run restore:local -- --file ./backup-2026-04-12.zip --mode replace

  # Restore specific bucket only
  npm run restore:local -- --file ./backup-2026-04-12.zip --bucket person-images

ENVIRONMENT VARIABLES:
  SUPABASE_URL               Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY  Supabase service role key
  GOOGLE_DRIVE_FOLDER_ID      Google Drive folder ID for backups
  GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH  Path to service account JSON

For more information, see RESTORE_README.md
`);
}

async function restoreFromLocal(args: CLIArgs): Promise<void> {
  if (!args['--file']) {
    console.error('Error: --file is required for local restore');
    console.error('Usage: npm run restore:local -- --file <path-to-backup.zip>');
    process.exit(1);
  }

  const archivePath = path.resolve(args['--file']);
  if (!fs.existsSync(archivePath)) {
    console.error(`Error: File not found: ${archivePath}`);
    process.exit(1);
  }

  const options: RestoreOptions = {
    dryRun: args['--dry-run'] || false,
    mode: args['--mode'] || 'upsert',
    backupFirst: args['--backup-first'] || false,
    buckets: args['--buckets'] || (args['--bucket'] ? [args['--bucket']] : undefined),
    skipExistingFiles: args['--skip-existing'] || false
  };

  console.log(`[Restore] Starting local restore from: ${archivePath}`);
  console.log(`[Restore] Options:`, JSON.stringify(options, null, 2));
  if (args['--manifest']) {
    console.log(`[Restore] Using external manifest: ${args['--manifest']}`);
  }

  if (options.dryRun) {
    console.log('[Restore] *** DRY RUN MODE - No changes will be made ***');
  }

  const report = await restoreService.runRestore(archivePath, options, args['--manifest']);
  process.exit(report.status === 'failed' ? 1 : 0);
}

async function restoreFromDrive(args: CLIArgs): Promise<void> {
  if (!args['--backup-date']) {
    console.error('Error: --backup-date is required for Drive restore');
    console.error('Usage: npm run restore:drive -- --backup-date 2026-04-12');
    process.exit(1);
  }

  const outputDir = args['--output-dir'] || path.join(__dirname, '..', '..', 'temp-downloads');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `backup-${args['--backup-date']}.zip`;
  const outputPath = path.join(outputDir, fileName);

  console.log(`[Restore] Downloading backup from Google Drive: ${fileName}`);

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    console.error('Error: GOOGLE_DRIVE_FOLDER_ID environment variable is not set');
    process.exit(1);
  }

  await restoreService.downloadFromDrive(fileName, folderId, outputPath);

  args['--file'] = outputPath;
  await restoreFromLocal(args);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args['--help']) {
    printHelp();
    process.exit(0);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
    console.error('Please configure your .env file or set environment variables');
    process.exit(1);
  }

  const scriptName = path.basename(process.argv[1]);

  if (scriptName.includes('drive')) {
    await restoreFromDrive(args);
  } else {
    await restoreFromLocal(args);
  }
}

main().catch(err => {
  console.error('[Restore] Fatal error:', err);
  process.exit(1);
});
