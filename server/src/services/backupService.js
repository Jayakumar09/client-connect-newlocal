import fs from 'fs';
import path from 'path';
import { DatabaseBackupService } from './databaseBackupService.js';
import { StorageBackupService } from './storageBackupService.js';
import { createZipArchive, verifyZipArchive, calculateZipChecksum } from '../utils/zip.js';
import { calculateFileChecksum, generateManifestChecksum } from '../utils/checksum.js';
import AdmZip from 'adm-zip';

const BACKUP_VERSION = '3.0.0';

class BackupService {
  constructor(config = {}) {
    this.config = config;
    this.tempDir = config.TEMP_BACKUP_DIR || process.env.TEMP_BACKUP_DIR || './temp/backup';
    this.outputDir = config.BACKUP_OUTPUT_DIR || process.env.BACKUP_OUTPUT_DIR || './backups';
    this.createdBy = config.CREATED_BY || process.env.ADMIN_EMAIL || 'system';
    
    this.databaseBackup = new DatabaseBackupService(config);
    this.storageBackup = new StorageBackupService(config);
  }

  async ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async cleanupTempDir(tempDir) {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`[BackupService] Cleaned up temp directory: ${tempDir}`);
      }
    } catch (err) {
      console.warn(`[BackupService] Could not cleanup temp dir:`, err.message);
    }
  }

  async runFullBackup(options = {}) {
    const {
      backupType = 'manual',
      includeSqlDump = true,
      includeJsonExport = true,
      includeStorage = true,
      cleanupAfter = true
    } = options;

    const timestamp = new Date().toISOString();
    const backupDate = timestamp.split('T')[0];
    const backupId = `backup-${backupDate}-${Date.now()}`;
    
    const tempDir = path.join(this.tempDir, backupId);
    await this.ensureDir(tempDir);
    
    const results = {
      backupId,
      backupVersion: BACKUP_VERSION,
      timestamp,
      backupDate,
      backupType,
      success: false,
      completeness: 'partial',
      isFullRestorable: false,
      database: null,
      storage: null,
      archive: null,
      manifest: null,
      errors: [],
      warnings: []
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[BackupService] Starting FULL backup: ${backupId}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      console.log('[BackupService] Step 1/4: Backing up database...');
      results.database = await this.databaseBackup.runFullBackup(tempDir, {
        includeSqlDump,
        includeJsonExport
      });
      
      if (!results.database.success) {
        results.warnings.push('Database backup had errors');
      }
      
      console.log(`[BackupService] Database backup: ${results.database.jsonExportSuccess ? 'JSON OK' : 'JSON FAILED'}, ${results.database.sqlDumpSuccess ? 'SQL OK' : 'SQL FAILED'}`);

      if (includeStorage) {
        console.log('\n[BackupService] Step 2/4: Backing up storage files...');
        results.storage = await this.storageBackup.runFullBackup(tempDir, {});
        
        if (results.storage.warnings.length > 0) {
          results.warnings.push(...results.storage.warnings);
        }
        
        console.log(`[BackupService] Storage backup: ${results.storage.totalFilesIncluded}/${results.storage.totalFilesExpected} files, ${results.storage.totalIncludedSize} bytes`);
      } else {
        console.log('[BackupService] Step 2/4: Skipping storage backup (disabled)');
        results.storage = {
          success: true,
          skipped: true,
          totalFilesExpected: 0,
          totalFilesIncluded: 0,
          totalFilesMissing: 0,
          totalIncludedSize: 0
        };
      }

      console.log('\n[BackupService] Step 3/4: Creating manifest...');
      const manifest = this.createManifest(results, backupId);
      results.manifest = manifest;
      
      const manifestPath = path.join(tempDir, 'backup-manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`[BackupService] Manifest created: ${manifestPath}`);

      console.log('\n[BackupService] Step 4/4: Creating ZIP archive...');
      await this.ensureDir(this.outputDir);
      const zipFileName = `backup-${backupDate}.zip`;
      const zipPath = path.join(this.outputDir, zipFileName);
      
      const archiveStats = await createZipArchive(tempDir, zipPath);
      
      const zipChecksum = await calculateZipChecksum(zipPath);
      results.archive = {
        fileName: zipFileName,
        filePath: zipPath,
        size: archiveStats.size,
        checksum: zipChecksum,
        fileCount: archiveStats.files,
        createdAt: new Date().toISOString()
      };
      
      console.log(`[BackupService] ZIP created: ${zipPath} (${archiveStats.size} bytes, ${archiveStats.files} files)`);

      const zipVerify = await verifyZipArchive(zipPath);
      if (!zipVerify.verified) {
        throw new Error('ZIP archive verification failed');
      }

      const dbBackupSuccess = results.database?.jsonExportSuccess === true;
      const storageComplete = results.storage?.totalFilesExpected === 0 || 
                              (results.storage?.totalFilesMissing === 0 && results.storage?.totalFilesIncluded > 0);
      const zipIntegrityOk = zipVerify.verified;

      results.isFullRestorable = 
        dbBackupSuccess === true &&
        storageComplete === true &&
        zipIntegrityOk === true;

      results.completeness = results.isFullRestorable ? 'full' : 'partial';
      results.success = results.isFullRestorable;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`[BackupService] BACKUP COMPLETE`);
      console.log(`${'='.repeat(60)}`);
      console.log(`  Completeness: ${results.completeness}`);
      console.log(`  Full Restorable: ${results.isFullRestorable}`);
      console.log(`  Database: ${results.database?.jsonExportSuccess ? 'OK' : 'FAILED'}`);
      console.log(`  Storage: ${results.storage?.totalFilesIncluded}/${results.storage?.totalFilesExpected} files`);
      console.log(`  ZIP Size: ${archiveStats.size} bytes`);
      console.log(`  Output: ${zipPath}`);
      console.log(`${'='.repeat(60)}\n`);

      if (cleanupAfter) {
        await this.cleanupTempDir(tempDir);
      }

      return results;

    } catch (err) {
      console.error(`[BackupService] Backup failed:`, err.message);
      results.errors.push(err.message);
      results.success = false;
      
      if (cleanupAfter) {
        await this.cleanupTempDir(tempDir);
      }
      
      return results;
    }
  }

  createManifest(backupResults, backupId) {
    const database = backupResults.database;
    const storage = backupResults.storage;
    const archive = backupResults.archive;

    const manifest = {
      manifest_version: BACKUP_VERSION,
      backup_id: backupId,
      backup_version: BACKUP_VERSION,
      backup_date: backupResults.backupDate,
      backup_type: backupResults.backupType,
      created_by: this.createdBy,
      created_at: backupResults.timestamp,
      
      completeness: backupResults.completeness,
      is_full_restorable: backupResults.isFullRestorable,
      
      database_engine: database?.engine || 'unknown',
      database: {
        tables: database?.recordCounts ? Object.keys(database.recordCounts) : [],
        record_counts: database?.recordCounts || {},
        total_records: database?.totalRecords || 0,
        sql_dump_included: database?.sqlDumpSuccess || false,
        json_export_included: database?.jsonExportSuccess || false,
        backup_size_bytes: database?.files?.find(f => f.fileName === 'database-export.json')?.size || 0,
        sql_dump_size_bytes: database?.files?.find(f => f.fileName === 'database.sql')?.size || 0
      },
      
      storage: {
        buckets: storage?.buckets || [],
        total_files_expected: storage?.totalFilesExpected || 0,
        total_files_included: storage?.totalFilesIncluded || 0,
        total_files_missing: storage?.totalFilesMissing || 0,
        total_expected_size: storage?.totalExpectedSize || 0,
        total_included_size: storage?.totalIncludedSize || 0,
        skipped: storage?.skipped || false
      },
      
      archive: {
        file_name: archive?.fileName || '',
        file_size: archive?.size || 0,
        checksum: archive?.checksum || '',
        file_count: archive?.fileCount || 0,
        created_at: archive?.createdAt || ''
      },
      
      validation: {
        is_valid: backupResults.success,
        is_complete: backupResults.completeness === 'full',
        warnings: backupResults.warnings,
        errors: backupResults.errors
      }
    };

    return manifest;
  }

  async verifyBackup(backupFilePath) {
    const results = {
      filePath: backupFilePath,
      valid: false,
      manifest: null,
      errors: [],
      warnings: []
    };

    try {
      const zipVerify = await verifyZipArchive(backupFilePath);
      if (!zipVerify.verified) {
        results.errors.push('ZIP verification failed');
        return results;
      }

      const zip = new AdmZip(backupFilePath);
      const entries = zip.getEntries();
      const fileNames = entries.map(e => e.entryName);

      const hasManifestV2 = fileNames.includes('backup-manifest.json');
      const hasManifestV1 = fileNames.includes('manifest.json');
      const hasDatabaseV2 = fileNames.includes('database-export.json');
      const hasDatabaseV1 = fileNames.includes('database/database-export.json');

      if (!hasManifestV2 && !hasManifestV1) {
        results.errors.push('No manifest found. Searched for: backup-manifest.json, manifest.json');
      }

      if (!hasDatabaseV2 && !hasDatabaseV1) {
        results.errors.push('No database-export.json found. Searched for: database-export.json, database/database-export.json');
      }
      
      if (results.errors.length > 0) {
        return results;
      }

      const manifestEntry = entries.find(e => e.entryName === 'backup-manifest.json') || 
                           entries.find(e => e.entryName === 'manifest.json');
      if (manifestEntry) {
        const manifestContent = zip.readAsText(manifestEntry);
        results.manifest = JSON.parse(manifestContent);
        console.log(`[BackupService] Verified manifest: ${manifestEntry.entryName}, backup ${results.manifest.backup_date}`);
      }

      const hasStorage = fileNames.some(f => f.startsWith('storage/'));
      if (results.manifest?.storage?.total_files_expected > 0 && !hasStorage) {
        results.errors.push('Storage files expected but not found in archive');
      }

      if (results.manifest?.is_full_restorable === false) {
        results.warnings.push('Manifest indicates backup is not fully restorable');
      }

      results.valid = results.errors.length === 0;

    } catch (err) {
      results.errors.push(err.message);
    }

    return results;
  }
}

export { BackupService, BACKUP_VERSION };