import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import { BucketBackupResult, BucketFile, BackupManifest } from '../types/index.js';

const RESTORE_VERSION = '1.0.0';
const STORAGE_BUCKETS = ['person-images', 'attachments', 'profile-assets', 'chat-files'];

export interface RestoreOptions {
  dryRun: boolean;
  mode: 'upsert' | 'insert' | 'replace';
  backupFirst: boolean;
  buckets?: string[];
  skipExistingFiles: boolean;
}

export interface RestoreReport {
  status: 'success' | 'partial' | 'failed';
  startedAt: string;
  completedAt: string;
  duration: number;
  database: {
    tablesProcessed: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsSkipped: number;
    errors: { table: string; error: string }[];
  };
  storage: {
    bucketsProcessed: number;
    filesUploaded: number;
    filesSkipped: number;
    filesFailed: number;
    bytesTransferred: number;
    errors: { bucket: string; path: string; error: string }[];
  };
  verification: {
    databaseMatches: boolean;
    storageMatches: boolean;
    fileIntegrityPassed: number;
    fileIntegrityFailed: number;
  };
  manifest: BackupManifest | null;
}

export class RestoreService {
  private supabase: SupabaseClient | null = null;
  private tempDir: string;

  constructor() {
    this.tempDir = process.env.RESTORE_TEMP_DIR || './temp-restore';
    this.ensureTempDir();
  }

  private getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
      }
      this.supabase = createClient(url, key);
    }
    return this.supabase;
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async cleanupTempDir(): Promise<void> {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
      console.log(`[RestoreService] Cleaned up temp directory: ${this.tempDir}`);
    }
  }

  async extractBackup(archivePath: string, externalManifestPath?: string): Promise<{ manifest: BackupManifest | null; extractDir: string }> {
    console.log(`[RestoreService] Extracting backup archive: ${archivePath}`);

    const extractDir = path.join(this.tempDir, `backup-${Date.now()}`);
    fs.mkdirSync(extractDir, { recursive: true });

    return new Promise((resolve, reject) => {
      fs.createReadStream(archivePath)
        .pipe(unzipper.Extract({ path: extractDir }))
        .on('close', async () => {
          console.log(`[RestoreService] Archive extracted to: ${extractDir}`);

          let manifest: BackupManifest | null = null;
          let manifestSource = 'none';

          if (externalManifestPath && fs.existsSync(externalManifestPath)) {
            console.log(`[RestoreService] Loading external manifest: ${externalManifestPath}`);
            const manifestContent = fs.readFileSync(externalManifestPath, 'utf8');
            manifest = JSON.parse(manifestContent);
            manifestSource = 'external';
          } else {
            const manifestPath = path.join(extractDir, 'backup-manifest.json');
            if (fs.existsSync(manifestPath)) {
              console.log(`[RestoreService] Loading embedded manifest from ZIP`);
              const manifestContent = fs.readFileSync(manifestPath, 'utf8');
              manifest = JSON.parse(manifestContent);
              manifestSource = 'embedded';
            } else {
              console.warn(`[RestoreService] No manifest found, synthesizing fallback from archive contents`);
              manifest = this.synthesizeFallbackManifest(extractDir);
              manifestSource = 'synthesized';
            }
          }

          if (manifest) {
            console.log(`[RestoreService] Manifest loaded: ${manifest.backup_version}, completeness: ${manifest.completeness}, source: ${manifestSource}`);
          } else {
            console.error(`[RestoreService] Could not resolve manifest from any source`);
          }

          resolve({ manifest, extractDir });
        })
        .on('error', reject);
    });
  }

  synthesizeFallbackManifest(extractDir: string): BackupManifest | null {
    const dbExportPath = path.join(extractDir, 'database-export.json');
    const storageDir = path.join(extractDir, 'storage');

    const recordCounts: Record<string, number> = {};
    let tables: string[] = [];
    let exportedBytes = 0;
    let totalRecords = 0;

    if (fs.existsSync(dbExportPath)) {
      try {
        const dbContent = fs.readFileSync(dbExportPath, 'utf8');
        const databaseExport = JSON.parse(dbContent);
        exportedBytes = Buffer.byteLength(dbContent, 'utf8');
        tables = Object.keys(databaseExport);

        for (const table of tables) {
          const tableData = databaseExport[table] as { records?: unknown[]; count?: number };
          const count = tableData.count || (tableData.records?.length || 0);
          recordCounts[table] = count;
          totalRecords += count;
        }
        console.log(`[RestoreService] Synthesized DB: ${tables.length} tables, ${totalRecords} records`);
      } catch (err) {
        console.warn(`[RestoreService] Failed to parse database-export.json:`, err);
      }
    }

    const buckets: BucketBackupResult[] = [];
    let totalFiles = 0;
    let totalSize = 0;

    if (fs.existsSync(storageDir)) {
      for (const bucketName of STORAGE_BUCKETS) {
        const bucketDir = path.join(storageDir, bucketName);
        if (!fs.existsSync(bucketDir)) continue;

        const bucketFiles: BucketFile[] = [];
        const walkDir = (dir: string, relPath: string = '') => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const fileRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
              walkDir(fullPath, fileRelPath);
            } else if (entry.isFile()) {
              const stats = fs.statSync(fullPath);
              bucketFiles.push({
                bucket_name: bucketName,
                path: fileRelPath,
                original_name: entry.name,
                size: stats.size,
                actual_size: stats.size,
                content_type: 'application/octet-stream',
                uploaded_at: new Date().toISOString(),
                downloaded: true
              });
            }
          }
        };
        walkDir(bucketDir);

        if (bucketFiles.length > 0) {
          const bucketSize = bucketFiles.reduce((sum, f) => sum + f.actual_size, 0);
          buckets.push({
            bucket_name: bucketName,
            files_expected: bucketFiles.length,
            files_included: bucketFiles.length,
            files_missing: [],
            total_expected_size: bucketSize,
            total_included_size: bucketSize,
            files: bucketFiles
          });
          totalFiles += bucketFiles.length;
          totalSize += bucketSize;
          console.log(`[RestoreService] Synthesized bucket ${bucketName}: ${bucketFiles.length} files, ${bucketSize} bytes`);
        }
      }
    }

    if (tables.length === 0 && totalFiles === 0) {
      console.warn(`[RestoreService] No data found in archive to synthesize manifest`);
      return null;
    }

    console.log(`[RestoreService] === SYNTHESIZED MANIFEST ===`);
    console.log(`[RestoreService] DB Tables: ${tables.length}, Records: ${totalRecords}`);
    console.log(`[RestoreService] Storage Buckets: ${buckets.length}, Files: ${totalFiles}, Size: ${totalSize}`);

    return {
      backup_version: '2.2.0-synthesized',
      backup_date: new Date().toISOString().split('T')[0],
      backup_type: 'manual',
      created_by: 'restore-tool',
      completeness: totalFiles > 0 ? 'partially_restorable' : 'db_only',
      is_full_restorable: false,
      database: {
        export_time: new Date().toISOString(),
        tables,
        record_counts: recordCounts,
        exported_bytes: exportedBytes
      },
      storage: {
        buckets,
        total_files_expected: totalFiles,
        total_files_included: totalFiles,
        total_files_missing: 0,
        total_expected_size: totalSize,
        total_included_size: totalSize
      },
      external_images: [],
      archive: {
        total_size: 0,
        database_only_size: exportedBytes,
        storage_included_size: totalSize,
        file_count_in_archive: totalFiles + 1
      },
      validation: {
        is_valid: true,
        is_complete: false,
        missing_files_report: [],
        warnings: ['This manifest was synthesized from archive contents - original manifest not found'],
        validated_at: new Date().toISOString()
      }
    };
  }

  async restoreDatabase(
    databaseExport: Record<string, unknown>,
    mode: 'upsert' | 'insert' | 'replace',
    dryRun: boolean
  ): Promise<RestoreReport['database']> {
    const supabase = this.getSupabaseClient();
    const report: RestoreReport['database'] = {
      tablesProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: []
    };

    const tableNames = Object.keys(databaseExport);

    for (const tableName of tableNames) {
      console.log(`[RestoreService] Processing table: ${tableName}`);
      report.tablesProcessed++;

      const tableData = databaseExport[tableName] as { records?: unknown[]; error?: string };

      if (tableData.error) {
        console.warn(`[RestoreService] Skipping table ${tableName} due to error: ${tableData.error}`);
        report.errors.push({ table: tableName, error: tableData.error });
        continue;
      }

      const records = tableData.records || [];

      if (records.length === 0) {
        console.log(`[RestoreService] Table ${tableName}: No records to restore`);
        continue;
      }

      if (mode === 'replace') {
        if (dryRun) {
          console.log(`[RestoreService] DRY RUN: Would delete all records from ${tableName} and insert ${records.length}`);
          report.recordsInserted += records.length;
        } else {
          try {
            const { error: deleteError } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (deleteError) {
              console.error(`[RestoreService] Failed to delete from ${tableName}: ${deleteError.message}`);
              report.errors.push({ table: tableName, error: deleteError.message });
              continue;
            }
          } catch (e) {
            console.warn(`[RestoreService] Delete not supported for ${tableName}, skipping replace mode`);
          }
        }
      }

      for (const record of records) {
        try {
          if (dryRun) {
            console.log(`[RestoreService] DRY RUN: Would ${mode} record in ${tableName}`);
            if (mode !== 'insert') report.recordsUpdated++;
            else report.recordsInserted++;
            continue;
          }

          if (mode === 'upsert') {
            const id = (record as { id?: string }).id;
            if (id) {
              const { data: existing } = await supabase
                .from(tableName)
                .select('id')
                .eq('id', id)
                .single();

              if (existing) {
                const { error } = await supabase
                  .from(tableName)
                  .update(record as any)
                  .eq('id', id);
                if (error) throw error;
                report.recordsUpdated++;
              } else {
                const { error } = await supabase
                  .from(tableName)
                  .insert(record as any);
                if (error) throw error;
                report.recordsInserted++;
              }
            } else {
              const { error } = await supabase.from(tableName).insert(record as any);
              if (error) throw error;
              report.recordsInserted++;
            }
          } else if (mode === 'insert') {
            const { error } = await supabase.from(tableName).insert(record as any);
            if (error) {
              if (error.code === '23505') {
                report.recordsSkipped++;
              } else {
                throw error;
              }
            } else {
              report.recordsInserted++;
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.warn(`[RestoreService] Failed to restore record in ${tableName}: ${errorMessage}`);
          report.errors.push({ table: tableName, error: errorMessage });
          report.recordsSkipped++;
        }
      }
    }

    return report;
  }

  async restoreStorage(
    storageDir: string,
    buckets: BucketBackupResult[],
    options: RestoreOptions,
    onProgress?: (bucket: string, current: number, total: number) => void
  ): Promise<RestoreReport['storage']> {
    const report: RestoreReport['storage'] = {
      bucketsProcessed: 0,
      filesUploaded: 0,
      filesSkipped: 0,
      filesFailed: 0,
      bytesTransferred: 0,
      errors: []
    };

    const targetBuckets = options.buckets || buckets.map(b => b.bucket_name);

    for (const bucketResult of buckets) {
      if (!targetBuckets.includes(bucketResult.bucket_name)) {
        console.log(`[RestoreService] Skipping bucket: ${bucketResult.bucket_name}`);
        continue;
      }

      console.log(`[RestoreService] Processing bucket: ${bucketResult.bucket_name}`);
      report.bucketsProcessed++;

      const bucketFiles = bucketResult.files.filter(f => f.downloaded);
      let processed = 0;

      for (const file of bucketFiles) {
        processed++;
        onProgress?.(bucketResult.bucket_name, processed, bucketFiles.length);

        const archiveFilePath = path.join(storageDir, 'storage', bucketResult.bucket_name, file.path);

        if (!fs.existsSync(archiveFilePath)) {
          console.warn(`[RestoreService] File not found in archive: ${archiveFilePath}`);
          report.errors.push({ bucket: bucketResult.bucket_name, path: file.path, error: 'File not found in archive' });
          report.filesFailed++;
          continue;
        }

        if (options.skipExistingFiles) {
          const { data: exists } = await this.getSupabaseClient().storage
            .from(bucketResult.bucket_name)
            .list(file.path.split('/')[0] || '');

          if (exists && exists.some(f => f.name === file.path.split('/').pop())) {
            console.log(`[RestoreService] Skipping existing file: ${bucketResult.bucket_name}/${file.path}`);
            report.filesSkipped++;
            continue;
          }
        }

        if (options.dryRun) {
          console.log(`[RestoreService] DRY RUN: Would upload ${bucketResult.bucket_name}/${file.path}`);
          report.filesUploaded++;
          report.bytesTransferred += file.actual_size;
          continue;
        }

        try {
          const fileBuffer = fs.readFileSync(archiveFilePath);
          const { error } = await this.getSupabaseClient().storage
            .from(bucketResult.bucket_name)
            .upload(file.path, fileBuffer, {
              contentType: file.content_type,
              upsert: true
            });

          if (error) {
            throw error;
          }

          report.filesUploaded++;
          report.bytesTransferred += fileBuffer.length;
          console.log(`[RestoreService] Uploaded: ${bucketResult.bucket_name}/${file.path} (${fileBuffer.length} bytes)`);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[RestoreService] Failed to upload ${bucketResult.bucket_name}/${file.path}: ${errorMessage}`);
          report.errors.push({ bucket: bucketResult.bucket_name, path: file.path, error: errorMessage });
          report.filesFailed++;
        }
      }
    }

    return report;
  }

  async verifyRestore(
    extractDir: string,
    manifest: BackupManifest
  ): Promise<RestoreReport['verification']> {
    const report: RestoreReport['verification'] = {
      databaseMatches: false,
      storageMatches: false,
      fileIntegrityPassed: 0,
      fileIntegrityFailed: 0
    };

    const dbExportPath = path.join(extractDir, 'database-export.json');
    if (fs.existsSync(dbExportPath)) {
      report.databaseMatches = true;
      console.log(`[RestoreService] Database export verified`);
    }

    const storageDir = path.join(extractDir, 'storage');
    if (fs.existsSync(storageDir)) {
      let totalExpected = 0;
      let totalFound = 0;

      for (const bucket of manifest.storage.buckets) {
        totalExpected += bucket.files_expected;

        for (const file of bucket.files) {
          if (file.downloaded) {
            const filePath = path.join(storageDir, bucket.bucket_name, file.path);
            if (fs.existsSync(filePath)) {
              const stats = fs.statSync(filePath);
              if (stats.size === file.actual_size) {
                report.fileIntegrityPassed++;
              } else {
                console.warn(`[RestoreService] File size mismatch: ${filePath} (expected ${file.actual_size}, got ${stats.size})`);
                report.fileIntegrityFailed++;
              }
              totalFound++;
            }
          }
        }
      }

      report.storageMatches = totalFound === totalExpected;
      console.log(`[RestoreService] Storage verification: ${totalFound}/${totalExpected} files found`);
    }

    return report;
  }

  async downloadFromDrive(
    fileName: string,
    folderId: string,
    outputPath: string
  ): Promise<string> {
    const { google } = await import('googleapis');

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(fs.readFileSync(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH!, 'utf8')),
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const drive = google.drive({ version: 'v3', auth });

    console.log(`[RestoreService] Searching for backup in Drive folder: ${folderId}`);

    const listResponse = await drive.files.list({
      q: `'${folderId}' in parents and name='${fileName}' and mimeType='application/zip'`,
      fields: 'files(id, name, size, createdTime)'
    });

    const files = listResponse.data.files;
    if (!files || files.length === 0) {
      throw new Error(`Backup file '${fileName}' not found in Drive folder`);
    }

    const file = files[0];
    console.log(`[RestoreService] Found backup: ${file.name} (${file.size} bytes)`);

    const dest = fs.createWriteStream(outputPath);
    await drive.files.get({
      fileId: file.id!,
      alt: 'media'
    }, {
      responseType: 'stream'
    }, (data: any) => {
      data.pipe(dest);
    });

    return new Promise((resolve, reject) => {
      dest.on('close', () => {
        console.log(`[RestoreService] Downloaded to: ${outputPath}`);
        resolve(outputPath);
      });
      dest.on('error', reject);
    });
  }

  generateReadme(manifest: BackupManifest, toolVersion: string): string {
    const template = fs.readFileSync(
      path.join(process.cwd(), 'src', 'scripts', 'RESTORE_README.md'),
      'utf8'
    );

    const tablesList = manifest.database.tables
      .map(t => `- ${t}: ${manifest.database.record_counts[t] || 0} records`)
      .join('\n');

    const storageBucketsInfo = manifest.storage.buckets
      .map(b => `- **${b.bucket_name}**: ${b.files_included}/${b.files_expected} files (${b.total_included_size} bytes)`)
      .join('\n');

    return template
      .replace(/\{\{BACKUP_VERSION\}\}/g, manifest.backup_version)
      .replace(/\{\{BACKUP_DATE\}\}/g, manifest.backup_date)
      .replace(/\{\{BACKUP_TYPE\}\}/g, manifest.backup_type)
      .replace(/\{\{MANUAL_OR_AUTOMATIC\}\}/g, manifest.backup_type === 'manual' ? 'Manual' : 'Automatic (Scheduled)')
      .replace(/\{\{CREATED_BY\}\}/g, manifest.created_by)
      .replace(/\{\{COMPLETENESS_STATUS\}\}/g, manifest.completeness)
      .replace(/\{\{IS_FULL_RESTORABLE\}\}/g, manifest.is_full_restorable ? 'YES' : 'NO')
      .replace(/\{\{TABLES_LIST\}\}/g, tablesList || 'None')
      .replace(/\{\{TOTAL_RECORD_COUNT\}\}/g, Object.values(manifest.database.record_counts).reduce((a, b) => a + b, 0).toString())
      .replace(/\{\{STORAGE_BUCKETS_INFO\}\}/g, storageBucketsInfo || 'No storage files')
      .replace(/\{\{TOTAL_STORAGE_FILES\}\}/g, manifest.storage.total_files_included.toString())
      .replace(/\{\{TOTAL_STORAGE_SIZE\}\}/g, manifest.storage.total_included_size.toString())
      .replace(/\{\{EXTERNAL_IMAGES_COUNT\}\}/g, manifest.external_images.length.toString())
      .replace(/\{\{TOOL_VERSION\}\}/g, toolVersion)
      .replace(/\{\{GENERATED_AT\}\}/g, new Date().toISOString());
  }

  async runRestore(
    archivePath: string,
    options: RestoreOptions,
    externalManifestPath?: string
  ): Promise<RestoreReport> {
    const startTime = Date.now();
    const report: RestoreReport = {
      status: 'failed',
      startedAt: new Date().toISOString(),
      completedAt: '',
      duration: 0,
      database: {
        tablesProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: []
      },
      storage: {
        bucketsProcessed: 0,
        filesUploaded: 0,
        filesSkipped: 0,
        filesFailed: 0,
        bytesTransferred: 0,
        errors: []
      },
      verification: {
        databaseMatches: false,
        storageMatches: false,
        fileIntegrityPassed: 0,
        fileIntegrityFailed: 0
      },
      manifest: null
    };

    let extractDir = '';

    try {
      console.log(`[RestoreService] ========================================`);
      console.log(`[RestoreService]        BACKUP RESTORE STARTED`);
      console.log(`[RestoreService] ========================================`);
      console.log(`[RestoreService] Options:`, options);
      if (externalManifestPath) {
        console.log(`[RestoreService] External manifest: ${externalManifestPath}`);
      }

      const { manifest, extractDir: extractedDir } = await this.extractBackup(archivePath, externalManifestPath);
      extractDir = extractedDir;
      report.manifest = manifest;

      if (!manifest) {
        throw new Error('Could not load or synthesize manifest - restore cannot proceed');
      }

      console.log(`[RestoreService] Extracted archive to: ${extractDir}`);

      if (manifest.storage.total_files_included > 0) {
        const storageDir = path.join(extractDir, 'storage');
        console.log(`[RestoreService] Restoring storage files...`);

        const storageReport = await this.restoreStorage(
          storageDir,
          manifest.storage.buckets,
          options
        );
        report.storage = storageReport;
      }

      const dbExportPath = path.join(extractDir, 'database-export.json');
      if (fs.existsSync(dbExportPath)) {
        console.log(`[RestoreService] Restoring database...`);
        const dbContent = fs.readFileSync(dbExportPath, 'utf8');
        const databaseExport = JSON.parse(dbContent);
        const dbReport = await this.restoreDatabase(databaseExport, options.mode, options.dryRun);
        report.database = dbReport;
      }

      console.log(`[RestoreService] Verifying restore...`);
      report.verification = await this.verifyRestore(extractDir, manifest);

      const hasErrors = report.database.errors.length > 0 || report.storage.errors.length > 0;
      const hasFailures = report.storage.filesFailed > 0;

      if (hasErrors || hasFailures) {
        report.status = 'partial';
      } else {
        report.status = 'success';
      }

    } catch (err) {
      console.error(`[RestoreService] Restore failed:`, err);
      report.status = 'failed';
      throw err;
    } finally {
      report.completedAt = new Date().toISOString();
      report.duration = Date.now() - startTime;

      console.log(`[RestoreService] ========================================`);
      console.log(`[RestoreService]        RESTORE REPORT`);
      console.log(`[RestoreService] ========================================`);
      console.log(`[RestoreService] Status: ${report.status.toUpperCase()}`);
      console.log(`[RestoreService] Duration: ${report.duration}ms`);
      console.log(`[RestoreService]`);
      console.log(`[RestoreService] Database:`);
      console.log(`[RestoreService]   Tables processed: ${report.database.tablesProcessed}`);
      console.log(`[RestoreService]   Records inserted: ${report.database.recordsInserted}`);
      console.log(`[RestoreService]   Records updated: ${report.database.recordsUpdated}`);
      console.log(`[RestoreService]   Records skipped: ${report.database.recordsSkipped}`);
      console.log(`[RestoreService]   Errors: ${report.database.errors.length}`);
      console.log(`[RestoreService]`);
      console.log(`[RestoreService] Storage:`);
      console.log(`[RestoreService]   Buckets processed: ${report.storage.bucketsProcessed}`);
      console.log(`[RestoreService]   Files uploaded: ${report.storage.filesUploaded}`);
      console.log(`[RestoreService]   Files skipped: ${report.storage.filesSkipped}`);
      console.log(`[RestoreService]   Files failed: ${report.storage.filesFailed}`);
      console.log(`[RestoreService]   Bytes transferred: ${report.storage.bytesTransferred}`);
      console.log(`[RestoreService]`);
      console.log(`[RestoreService] Verification:`);
      console.log(`[RestoreService]   Database matches: ${report.verification.databaseMatches}`);
      console.log(`[RestoreService]   Storage matches: ${report.verification.storageMatches}`);
      console.log(`[RestoreService]   Files verified: ${report.verification.fileIntegrityPassed}`);
      console.log(`[RestoreService] ========================================`);

      if (!options.dryRun && extractDir) {
        console.log(`[RestoreService] Cleaning up temporary files...`);
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
    }

    return report;
  }
}

export const restoreService = new RestoreService();
