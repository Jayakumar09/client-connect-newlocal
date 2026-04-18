import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import AdmZip from 'adm-zip';

class RestoreService {
  constructor(config = {}) {
    this.supabaseUrl = config.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    this.supabaseKey = config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    this.databaseUrl = config.DATABASE_URL || process.env.DATABASE_URL;
    this.tempDir = config.TEMP_BACKUP_DIR || process.env.TEMP_BACKUP_DIR || './temp/restore';
    this.supabase = null;
    
    if (this.supabaseUrl && this.supabaseKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    }
  }

  async ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async extractBackup(backupFilePath) {
    const tempDir = path.join(this.tempDir, `restore-${Date.now()}`);
    await this.ensureDir(tempDir);

    console.log(`[RestoreService] Extracting backup to: ${tempDir}`);
    
    const zip = new AdmZip(backupFilePath);
    zip.extractAllTo(tempDir, true);

    const entries = zip.getEntries();
    const fileNames = entries.map(e => e.entryName);

    const hasManifestV1 = fileNames.includes('manifest.json');
    const hasManifestV2 = fileNames.includes('backup-manifest.json');

    return {
      extractDir: tempDir,
      fileNames,
      hasManifest: hasManifestV1 || hasManifestV2,
      hasManifestV1,
      hasManifestV2,
      hasDatabase: fileNames.includes('database/database-export.json') || fileNames.includes('database-export.json'),
      hasSqlDump: fileNames.includes('database/database.sql'),
      hasStorage: fileNames.some(f => f.startsWith('storage/'))
    };
  }

  async loadManifest(extractDir) {
    const manifestPathV2 = path.join(extractDir, 'backup-manifest.json');
    const manifestPathV1 = path.join(extractDir, 'manifest.json');
    
    if (fs.existsSync(manifestPathV2)) {
      console.log(`[RestoreService] Loading manifest: backup-manifest.json`);
      const content = fs.readFileSync(manifestPathV2, 'utf8');
      const manifest = JSON.parse(content);
      console.log(`[RestoreService] Loaded manifest: backup ${manifest.backup_date}, completeness: ${manifest.completeness}`);
      return manifest;
    }
    
    if (fs.existsSync(manifestPathV1)) {
      console.log(`[RestoreService] Loading manifest: manifest.json (legacy format)`);
      const content = fs.readFileSync(manifestPathV1, 'utf8');
      const manifest = JSON.parse(content);
      console.log(`[RestoreService] Loaded manifest: backup ${manifest.backup_date}, completeness: ${manifest.completeness}`);
      return manifest;
    }

    throw new Error(`Manifest not found in backup. Searched for: backup-manifest.json, manifest.json`);
  }

  async verifyBackupStructure(extractDir, manifest) {
    const results = {
      valid: true,
      errors: [],
      warnings: []
    };

    const dbExportV2 = path.join(extractDir, 'database-export.json');
    const dbExportV1 = path.join(extractDir, 'database/database-export.json');
    const hasDatabaseExport = fs.existsSync(dbExportV2) || fs.existsSync(dbExportV1);

    const manifestFile = fs.existsSync(path.join(extractDir, 'backup-manifest.json')) ? 'backup-manifest.json' : 
                        fs.existsSync(path.join(extractDir, 'manifest.json')) ? 'manifest.json' : null;

    if (!manifestFile) {
      results.valid = false;
      results.errors.push('No manifest file found');
    }

    if (!hasDatabaseExport) {
      results.valid = false;
      results.errors.push('No database-export.json found (checked both root and database/ subdirectory)');
    }

    if (manifest.storage?.total_files_expected > 0) {
      const storageExists = fs.existsSync(path.join(extractDir, 'storage'));
      if (!storageExists) {
        results.valid = false;
        results.errors.push('Storage files expected but not found');
      }
    }

    if (manifest.is_full_restorable === false) {
      results.warnings.push('Manifest indicates backup is not fully restorable');
    }

    return results;
  }

  async restoreDatabase(extractDir, options = {}) {
    const { mode = 'upsert', dryRun = false } = options;
    
    const results = {
      success: false,
      mode,
      dryRun,
      tablesProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: []
    };

    const dbExportPathV2 = path.join(extractDir, 'database-export.json');
    const dbExportPathV1 = path.join(extractDir, 'database/database-export.json');
    const dbExportPath = fs.existsSync(dbExportPathV2) ? dbExportPathV2 : dbExportPathV1;
    const sqlDumpPath = path.join(extractDir, 'database/database.sql');

    if (fs.existsSync(sqlDumpPath) && !dryRun) {
      console.log('[RestoreService] Found SQL dump, attempting to restore via psql...');
      try {
        await this.restoreViaPsql(sqlDumpPath);
        results.success = true;
        results.recordsInserted = -1;
        console.log('[RestoreService] SQL dump restored via psql');
        return results;
      } catch (err) {
        console.warn('[RestoreService] psql restore failed, falling back to JSON:', err.message);
      }
    }

    if (!fs.existsSync(dbExportPath)) {
      results.errors.push(`database-export.json not found at ${dbExportPath}`);
      return results;
    }

    console.log(`[RestoreService] Restoring database from JSON (mode: ${mode})...`);
    
    const dbExport = JSON.parse(fs.readFileSync(dbExportPath, 'utf8'));
    const tables = Object.keys(dbExport);

    results.tablesProcessed = tables.length;
    console.log(`[RestoreService] Processing ${tables.length} tables`);

    for (const table of tables) {
      const tableData = dbExport[table];
      
      if (!tableData || !tableData.records) {
        console.warn(`[RestoreService] Skipping table ${table}: no records`);
        continue;
      }

      const records = tableData.records;
      console.log(`[RestoreService] Processing ${table}: ${records.length} records`);

      if (dryRun) {
        results.recordsInserted += records.length;
        continue;
      }

      try {
        const result = await this.restoreTableData(table, records, mode);
        results.recordsInserted += result.inserted;
        results.recordsUpdated += result.updated;
        results.recordsSkipped += result.skipped;
      } catch (err) {
        console.error(`[RestoreService] Error restoring table ${table}:`, err.message);
        results.errors.push({ table, error: err.message });
      }
    }

    results.success = results.errors.length === 0;
    console.log(`[RestoreService] Database restore complete: ${results.recordsInserted} inserted, ${results.recordsUpdated} updated, ${results.recordsSkipped} skipped`);

    return results;
  }

  async restoreTableData(tableName, records, mode) {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    const results = { inserted: 0, updated: 0, skipped: 0 };

    for (const record of records) {
      try {
        if (mode === 'insert') {
          const { error } = await this.supabase.from(tableName).insert(record);
          if (error) {
            if (error.code === '23505') {
              results.skipped++;
            } else {
              throw error;
            }
          } else {
            results.inserted++;
          }
        } else if (mode === 'upsert' || mode === 'replace') {
          const { error } = await this.supabase.from(tableName).upsert(record, { onConflict: 'id' });
          if (error) {
            if (error.code === '23505') {
              results.skipped++;
            } else {
              results.updated++;
            }
          } else {
            results.inserted++;
          }
        }
      } catch (err) {
        throw err;
      }
    }

    return results;
  }

  async restoreViaPsql(sqlDumpPath) {
    if (!this.databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    console.log('[RestoreService] Running psql to restore SQL dump...');

    return new Promise((resolve, reject) => {
      const child = spawn('psql', [this.databaseUrl, '-f', sqlDumpPath], {
        shell: true,
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (code === 0) {
          console.log('[RestoreService] psql restore completed successfully');
          resolve({ success: true });
        } else {
          reject(new Error(`psql failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', reject);
    });
  }

  async restoreStorage(extractDir, options = {}) {
    const { bucketFilter = null, dryRun = false } = options;
    
    const results = {
      success: false,
      dryRun,
      bucketsProcessed: 0,
      filesUploaded: 0,
      filesSkipped: 0,
      filesFailed: 0,
      bytesTransferred: 0,
      errors: []
    };

    const storageDir = path.join(extractDir, 'storage');
    
    if (!fs.existsSync(storageDir)) {
      results.errors.push('storage directory not found in backup');
      return results;
    }

    const bucketDirs = fs.readdirSync(storageDir);
    console.log(`[RestoreService] Found ${bucketDirs.length} buckets to restore`);

    for (const bucketName of bucketDirs) {
      if (bucketFilter && bucketFilter !== bucketName) {
        console.log(`[RestoreService] Skipping bucket ${bucketName} (filtered)`);
        continue;
      }

      const bucketPath = path.join(storageDir, bucketName);
      const stat = fs.statSync(bucketPath);

      if (!stat.isDirectory()) {
        continue;
      }

      console.log(`[RestoreService] Restoring bucket: ${bucketName}`);
      results.bucketsProcessed++;

      const bucketResult = await this.restoreBucket(bucketName, bucketPath, { dryRun });
      
      results.filesUploaded += bucketResult.uploaded;
      results.filesSkipped += bucketResult.skipped;
      results.filesFailed += bucketResult.failed;
      results.bytesTransferred += bucketResult.bytes;
      
      if (bucketResult.errors.length > 0) {
        results.errors.push(...bucketResult.errors);
      }
    }

    results.success = results.filesFailed === 0 && results.errors.length === 0;
    
    console.log(`[RestoreService] Storage restore complete: ${results.filesUploaded} uploaded, ${results.filesSkipped} skipped, ${results.filesFailed} failed`);

    return results;
  }

  async restoreBucket(bucketName, bucketDir, options = {}) {
    const { dryRun = false } = options;
    
    const result = {
      uploaded: 0,
      skipped: 0,
      failed: 0,
      bytes: 0,
      errors: []
    };

    const files = this.walkDirectory(bucketDir, bucketDir);
    
    console.log(`[RestoreService] Processing ${files.length} files in bucket ${bucketName}`);

    for (const file of files) {
      const relativePath = path.relative(bucketDir, file.path);
      
      if (dryRun) {
        result.uploaded++;
        result.bytes += file.size;
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(file.path);
        
        const { error } = await this.supabase.storage
          .from(bucketName)
          .upload(relativePath, fileBuffer, {
            upsert: true,
            contentType: this.guessMimeType(file.path)
          });

        if (error) {
          result.failed++;
          result.errors.push({ path: relativePath, error: error.message });
          console.warn(`[RestoreService] Failed to upload ${relativePath}:`, error.message);
        } else {
          result.uploaded++;
          result.bytes += fileBuffer.length;
          console.log(`[RestoreService] ✓ Uploaded ${bucketName}/${relativePath}`);
        }
      } catch (err) {
        result.failed++;
        result.errors.push({ path: relativePath, error: err.message });
        console.error(`[RestoreService] Error uploading ${relativePath}:`, err.message);
      }
    }

    return result;
  }

  walkDirectory(dir, baseDir) {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        files.push(...this.walkDirectory(fullPath, baseDir));
      } else {
        const stat = fs.statSync(fullPath);
        files.push({
          path: fullPath,
          relativePath: path.relative(baseDir, fullPath),
          size: stat.size
        });
      }
    }

    return files;
  }

  guessMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async runFullRestore(backupFilePath, options = {}) {
    const { 
      restoreDb = true, 
      restoreStorage = true, 
      dbMode = 'upsert',
      storageBucket = null,
      dryRun = false 
    } = options;

    const results = {
      backupFile: backupFilePath,
      dryRun,
      success: false,
      extract: null,
      manifest: null,
      database: null,
      storage: null,
      report: null
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[RestoreService] Starting FULL restore: ${backupFilePath}`);
    console.log(`  Dry Run: ${dryRun}`);
    console.log(`  Restore DB: ${restoreDb}`);
    console.log(`  Restore Storage: ${restoreStorage}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      console.log('[RestoreService] Step 1/5: Extracting backup...');
      results.extract = await this.extractBackup(backupFilePath);

      console.log('[RestoreService] Step 2/5: Loading manifest...');
      results.manifest = await this.loadManifest(results.extract.extractDir);

      console.log('[RestoreService] Step 3/5: Verifying backup structure...');
      const verifyResult = await this.verifyBackupStructure(results.extract.extractDir, results.manifest);
      
      if (!verifyResult.valid) {
        throw new Error(`Backup verification failed: ${verifyResult.errors.join(', ')}`);
      }
      
      if (verifyResult.warnings.length > 0) {
        console.warn('[RestoreService] Warnings:', verifyResult.warnings);
      }

      if (restoreDb) {
        console.log('\n[RestoreService] Step 4/5: Restoring database...');
        results.database = await this.restoreDatabase(results.extract.extractDir, {
          mode: dbMode,
          dryRun
        });
      } else {
        console.log('[RestoreService] Step 4/5: Skipping database restore');
      }

      if (restoreStorage) {
        console.log('\n[RestoreService] Step 5/5: Restoring storage...');
        results.storage = await this.restoreStorage(results.extract.extractDir, {
          bucketFilter: storageBucket,
          dryRun
        });
      } else {
        console.log('[RestoreService] Step 5/5: Skipping storage restore');
      }

      results.report = this.generateRestoreReport(results);
      results.success = (results.database?.success !== false) && (results.storage?.success !== false);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`[RestoreService] RESTORE COMPLETE`);
      console.log(`${'='.repeat(60)}`);
      console.log(`  Status: ${results.success ? 'SUCCESS' : 'FAILED'}`);
      if (results.database) {
        console.log(`  DB: ${results.database.recordsInserted} inserted, ${results.database.recordsUpdated} updated`);
      }
      if (results.storage) {
        console.log(`  Storage: ${results.storage.filesUploaded} uploaded, ${results.storage.filesFailed} failed`);
      }
      console.log(`${'='.repeat(60)}\n`);

      return results;

    } catch (err) {
      console.error(`[RestoreService] Restore failed:`, err.message);
      results.success = false;
      results.error = err.message;
      return results;
    }
  }

  generateRestoreReport(results) {
    return {
      timestamp: new Date().toISOString(),
      backup_file: results.backupFile,
      backup_date: results.manifest?.backup_date,
      backup_version: results.manifest?.backup_version,
      dry_run: results.dryRun,
      database: {
        restored: results.database !== null,
        mode: results.database?.mode,
        tables_processed: results.database?.tablesProcessed,
        records_inserted: results.database?.recordsInserted,
        records_updated: results.database?.recordsUpdated,
        records_skipped: results.database?.recordsSkipped,
        errors: results.database?.errors
      },
      storage: {
        restored: results.storage !== null,
        buckets_processed: results.storage?.bucketsProcessed,
        files_uploaded: results.storage?.filesUploaded,
        files_skipped: results.storage?.filesSkipped,
        files_failed: results.storage?.filesFailed,
        bytes_transferred: results.storage?.bytesTransferred,
        errors: results.storage?.errors
      },
      overall_success: results.success
    };
  }

  async cleanupTempDir(tempDir) {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`[RestoreService] Cleaned up temp directory: ${tempDir}`);
      }
    } catch (err) {
      console.warn(`[RestoreService] Could not cleanup temp dir:`, err.message);
    }
  }
}

export { RestoreService };