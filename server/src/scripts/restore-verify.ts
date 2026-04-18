#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BackupManifest } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

interface VerifyOptions {
  file?: string;
  backupDate?: string;
  manifest?: string;
  full: boolean;
  quick: boolean;
  buckets?: string[];
}

function parseArgs(): VerifyOptions {
  const args: VerifyOptions = { full: false, quick: false };
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file' || arg === '-f') {
      args.file = argv[++i];
    } else if (arg === '--backup-date' || arg === '-d') {
      args.backupDate = argv[++i];
    } else if (arg === '--manifest' || arg === '-M') {
      args.manifest = argv[++i];
    } else if (arg === '--full') {
      args.full = true;
    } else if (arg === '--quick') {
      args.quick = true;
    } else if (arg === '--bucket') {
      if (!args.buckets) args.buckets = [];
      args.buckets.push(argv[++i]);
    }
  }

  return args;
}

async function verifyFromManifest(
  manifest: BackupManifest,
  supabase: SupabaseClient,
  options: VerifyOptions
): Promise<void> {
  console.log('\n========================================');
  console.log('        VERIFICATION REPORT');
  console.log('========================================\n');

  console.log('Backup Information:');
  console.log(`  Version: ${manifest.backup_version}`);
  console.log(`  Date: ${manifest.backup_date}`);
  console.log(`  Type: ${manifest.backup_type}`);
  console.log(`  Completeness: ${manifest.completeness}`);
  console.log(`  Fully Restorable: ${manifest.is_full_restorable ? 'YES' : 'NO'}\n`);

  console.log('Database:');
  console.log(`  Tables: ${manifest.database.tables.length}`);
  console.log(`  Total Records: ${Object.values(manifest.database.record_counts).reduce((a, b) => a + b, 0)}`);
  console.log(`  Export Size: ${manifest.database.exported_bytes} bytes\n`);

  console.log('Storage:');
  console.log(`  Buckets: ${manifest.storage.buckets.length}`);
  console.log(`  Total Files Expected: ${manifest.storage.total_files_expected}`);
  console.log(`  Total Files Included: ${manifest.storage.total_files_included}`);
  console.log(`  Total Size: ${manifest.storage.total_included_size} bytes\n`);

  for (const bucket of manifest.storage.buckets) {
    if (options.buckets && !options.buckets.includes(bucket.bucket_name)) {
      continue;
    }
    console.log(`  Bucket: ${bucket.bucket_name}`);
    console.log(`    Files: ${bucket.files_included}/${bucket.files_expected}`);
    console.log(`    Size: ${bucket.total_included_size} bytes`);
    if (bucket.files_missing.length > 0) {
      console.log(`    Missing: ${bucket.files_missing.length}`);
      console.log(`    First 5 missing: ${bucket.files_missing.slice(0, 5).join(', ')}`);
    }
    console.log('');
  }

  if (options.full || options.quick) {
    console.log('Live Verification:\n');

    let dbMatches = true;
    for (const table of manifest.database.tables.slice(0, options.quick ? 3 : undefined)) {
      const expectedCount = manifest.database.record_counts[table] || 0;
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      const actualCount = count || 0;
      const match = actualCount >= expectedCount;
      dbMatches = dbMatches && match;
      console.log(`  Table ${table}: expected >= ${expectedCount}, actual = ${actualCount} ${match ? '✓' : '✗'}`);
    }

    console.log(`\n  Database Match: ${dbMatches ? '✓ PASS' : '✗ FAIL'}`);
  }

  if (manifest.validation.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of manifest.validation.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  console.log('\n========================================\n');
}

async function verifyFromFile(filePath: string, options: VerifyOptions): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const { restoreService } = await import('../services/restore-service.js');
  const { manifest, extractDir } = await restoreService.extractBackup(filePath, options.manifest);

  if (!manifest) {
    console.error('Error: Could not load or synthesize manifest');
    process.exit(1);
  }

  const verifyExtractDir = path.join(process.cwd(), 'temp-verify-extract');
  await fs.promises.mkdir(verifyExtractDir, { recursive: true });

  try {
    const unzipper = await import('unzipper');
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(unzipper.Extract({ path: verifyExtractDir }))
        .on('close', resolve)
        .on('error', reject);
    });

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );

    await verifyFromManifest(manifest, supabase, options);

  } finally {
    await fs.promises.rm(verifyExtractDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (!options.file && !options.backupDate) {
    console.error('Error: --file or --backup-date is required');
    console.error('Usage: npm run restore:verify -- --file <path> [--full] [--quick]');
    process.exit(1);
  }

  if (options.file) {
    const resolvedPath = path.resolve(options.file);
    await verifyFromFile(resolvedPath, options);
  } else {
    console.error('Error: Drive verification not yet implemented. Please download the backup first.');
    console.error(`Usage: npm run restore:drive -- --backup-date ${options.backupDate} --output-dir ./downloads`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
