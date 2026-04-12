#!/usr/bin/env node

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { RestoreService } from '../src/services/restoreService.js';
import { LocalPostgresRestoreService } from '../src/services/localDbRestore.js';
import AdmZip from 'adm-zip';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    source: 'local',
    only: 'full',
    file: null,
    dryRun: false,
    dbMode: 'upsert',
    bucket: null,
    localDb: false,
    clearDb: false,
    skipStorage: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--source':
      case '-s':
        options.source = args[++i];
        break;
      case '--only':
      case '-o':
        options.only = args[++i];
        break;
      case '--file':
      case '-f':
        options.file = args[++i];
        break;
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      case '--db-mode':
        options.dbMode = args[++i];
        break;
      case '--bucket':
        options.bucket = args[++i];
        break;
      case '--local-db':
        options.localDb = true;
        break;
      case '--clear-db':
        options.clearDb = true;
        break;
      case '--skip-storage':
        options.skipStorage = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  if (!options.file) {
    console.error('Error: --file is required');
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp() {
  console.log(`
Restore System - CLI

Usage: node runRestore.js --file <backup-file> [options]

Options:
  --source <type>      Source type: local (default)
  --only <mode>       Restore mode: db, storage, full (default: full)
  --file, -f          Backup file path (required)
  --dry-run, -d       Validate without making changes
  --db-mode <mode>    Database restore mode: insert, upsert, replace (default: upsert)
  --bucket <name>     Restore specific storage bucket only
  --local-db          Restore database to local PostgreSQL (default: uses DATABASE_URL)
  --clear-db          Clear tables before restoring (with --local-db)
  --skip-storage      Skip storage restore
  --help, -h          Show this help

Prerequisites for --local-db:
  1. Run Prisma migrations to create tables:
     npx prisma migrate deploy
     OR
     npx prisma db push

  2. Verify DATABASE_URL in .env:
     DATABASE_URL="postgresql://postgres:password@localhost:5432/matrimony_restore_test"

Examples:
  node runRestore.js --file ./backups/backup-2026-04-12.zip --dry-run
  node runRestore.js --file ./backups/backup-2026-04-12.zip --local-db
  node runRestore.js --file ./backups/backup-2026-04-12.zip --local-db --clear-db
  node runRestore.js --file ./backups/backup-2026-04-12.zip --local-db --db-mode insert
  node runRestore.js --file ./backups/backup-2026-04-12.zip --local-db --only db
  `);
}

async function loadManifestFromZip(backupFilePath) {
  const zip = new AdmZip(backupFilePath);
  const entries = zip.getEntries();
  
  const manifestEntry = entries.find(e => e.entryName === 'backup-manifest.json') ||
                        entries.find(e => e.entryName === 'manifest.json');
  
  if (!manifestEntry) {
    throw new Error('No manifest found in backup archive');
  }
  
  const content = zip.readAsText(manifestEntry);
  return JSON.parse(content);
}

function getDbExportPath(extractDir) {
  const v2 = path.join(extractDir, 'database-export.json');
  const v1 = path.join(extractDir, 'database', 'database-export.json');
  
  if (fs.existsSync(v2)) return v2;
  if (fs.existsSync(v1)) return v1;
  return null;
}

async function runLocalDbRestore(options) {
  console.log('\n' + '='.repeat(60));
  console.log('LOCAL POSTGRESQL RESTORE v3.1.0');
  console.log('='.repeat(60) + '\n');

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is not set');
    console.error('Example: postgresql://postgres:password@localhost:5432/mydb');
    process.exit(1);
  }

  console.log('[CLI] Configuration:');
  console.log(`  File: ${options.file}`);
  console.log(`  Mode: ${options.only}`);
  console.log(`  DB Mode: ${options.dbMode}`);
  console.log(`  Clear DB First: ${options.clearDb}`);
  if (options.bucket) console.log(`  Bucket: ${options.bucket}`);
  console.log();

  const pgService = new LocalPostgresRestoreService(databaseUrl);
  const connInfo = pgService.getConnectionInfo();

  console.log('[CLI] Connecting to local PostgreSQL...');
  await pgService.connect();

  let extractDir = null;
  let manifest = null;
  let dbExport = null;

  try {
    console.log('\n[CLI] Loading manifest from backup...');
    manifest = await loadManifestFromZip(options.file);
    console.log(`[CLI] Backup Date: ${manifest.backup_date}`);
    console.log(`[CLI] Storage Files: ${manifest.storage?.total_files_included || 0}`);
    console.log(`[CLI] Database Tables: ${manifest.database?.tables?.length || 0}`);

    if (options.only === 'storage' || options.skipStorage) {
      console.log('\n[CLI] Skipping database restore (storage only mode)');
    } else {
      console.log('\n[CLI] Extracting database export from ZIP...');
      const zip = new AdmZip(options.file);
      extractDir = path.join('./temp', `restore-${Date.now()}`);
      fs.mkdirSync(extractDir, { recursive: true });
      zip.extractAllTo(extractDir, true);

      const dbExportPath = getDbExportPath(extractDir);
      if (!dbExportPath) {
        throw new Error('database-export.json not found in backup');
      }

      console.log(`[CLI] Database export: ${dbExportPath}`);
      const dbContent = fs.readFileSync(dbExportPath, 'utf8');
      dbExport = JSON.parse(dbContent);

      console.log('\n[CLI] Checking for missing tables...');
      const { created, failed } = await pgService.createSchemaFromExport(dbExport);
      
      if (created > 0 || failed > 0) {
        console.log(`[CLI] Schema creation: ${created} tables created, ${failed} failed`);
      }

      console.log('\n[CLI] Restoring database...');
      const dbResult = await pgService.restoreDatabase(dbExport, {
        mode: options.dbMode,
        clearFirst: options.clearDb
      });

      console.log('\n[CLI] Verifying restore...');
      await pgService.verifyRestore(dbExport);
    }

    if (options.only === 'db') {
      console.log('\n[CLI] Database restore complete, storage restore skipped');
    } else if (!options.skipStorage && manifest.storage?.total_files_included > 0) {
      console.log('\n[CLI] Note: Storage restore to Supabase not implemented in local-db mode');
      console.log('[CLI] Use Supabase restore for storage files.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('RESTORE COMPLETE');
    console.log('='.repeat(60));
    console.log(`  Database: ${connInfo.database}@${connInfo.host}:${connInfo.port}`);
    console.log(`  Check your tables in pgAdmin4!`);
    console.log('='.repeat(60) + '\n');

  } catch (err) {
    console.error('\n[CLI] Restore failed:', err.message);
    throw err;
  } finally {
    await pgService.disconnect();
    if (extractDir && fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  }
}

async function runSupabaseRestore(options) {
  console.log('\n' + '='.repeat(60));
  console.log('RESTORE SYSTEM v3.0.0 (Supabase)');
  console.log('='.repeat(60) + '\n');

  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    TEMP_BACKUP_DIR: process.env.TEMP_BACKUP_DIR || './temp/restore'
  };

  const restoreService = new RestoreService(config);

  if (!fs.existsSync(options.file)) {
    console.error(`Error: Backup file not found: ${options.file}`);
    process.exit(1);
  }

  console.log('[CLI] Configuration:');
  console.log(`  File: ${options.file}`);
  console.log(`  Mode: ${options.only}`);
  console.log(`  Dry Run: ${options.dryRun}`);
  console.log(`  DB Mode: ${options.dbMode}`);
  if (options.bucket) console.log(`  Bucket: ${options.bucket}`);
  console.log();

  let restoreDb = false;
  let restoreStorage = false;

  switch (options.only) {
    case 'db':
      restoreDb = true;
      restoreStorage = false;
      break;
    case 'storage':
      restoreDb = false;
      restoreStorage = true;
      break;
    case 'full':
    default:
      restoreDb = true;
      restoreStorage = true;
      break;
  }

  const result = await restoreService.runFullRestore(options.file, {
    restoreDb,
    restoreStorage,
    dbMode: options.dbMode,
    storageBucket: options.bucket,
    dryRun: options.dryRun
  });

  console.log('\n' + '='.repeat(60));
  console.log('RESTORE RESULT');
  console.log('='.repeat(60));
  console.log(`  Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`  Dry Run: ${result.dryRun}`);
  
  if (result.manifest) {
    console.log(`  Backup Date: ${result.manifest.backup_date}`);
    console.log(`  Backup Version: ${result.manifest.backup_version}`);
  }

  if (result.database) {
    console.log('\n  Database:');
    console.log(`    Mode: ${result.database.mode}`);
    console.log(`    Tables: ${result.database.tablesProcessed}`);
    console.log(`    Inserted: ${result.database.recordsInserted}`);
    console.log(`    Updated: ${result.database.recordsUpdated}`);
    console.log(`    Skipped: ${result.database.recordsSkipped}`);
    if (result.database.errors?.length > 0) {
      console.log(`    Errors: ${result.database.errors.length}`);
    }
  }

  if (result.storage) {
    console.log('\n  Storage:');
    console.log(`    Buckets: ${result.storage.bucketsProcessed}`);
    console.log(`    Uploaded: ${result.storage.filesUploaded}`);
    console.log(`    Skipped: ${result.storage.filesSkipped}`);
    console.log(`    Failed: ${result.storage.filesFailed}`);
    console.log(`    Bytes: ${result.storage.bytesTransferred}`);
    if (result.storage.errors?.length > 0) {
      console.log(`    Errors: ${result.storage.errors.length}`);
    }
  }
  
  if (result.error) {
    console.log(`\n  Error: ${result.error}`);
  }
  
  console.log('='.repeat(60) + '\n');

  return result;
}

async function main() {
  const options = parseArgs();
  
  try {
    if (options.localDb) {
      await runLocalDbRestore(options);
    } else {
      await runSupabaseRestore(options);
    }
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

main();
