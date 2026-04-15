import { createClient, SupabaseClient } from '@supabase/supabase-js';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { BackupLog, BackupManifest, BackupProgress, StorageFile, ExternalImage, BucketBackupResult, BucketFile, ArchiveValidation, CompletenessStatus } from '../types/index.js';

const BACKUP_VERSION = '2.2.0';
const STORAGE_BUCKETS = ['person-images', 'attachments', 'profile-assets', 'chat-files'];
const MAX_PAGINATION_SIZE = 1000;

export interface ArchiveResult {
  archivePath: string;
  totalSize: number;
  databaseSize: number;
  storageSize: number;
  filesProcessed: number;
  filesIncluded: number;
  filesMissing: string[];
  bucketResults: BucketBackupResult[];
  totalExpectedSize: number;
  totalIncludedSize: number;
  filesInArchive: string[];
}

export class BackupService {
  private supabase: SupabaseClient | null = null;
  private tempDir: string;
  private retentionDays: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor() {
    this.tempDir = process.env.BACKUP_TEMP_DIR || './temp-backups';
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '7');
    this.retryAttempts = parseInt(process.env.BACKUP_RETRY_ATTEMPTS || '3');
    this.retryDelay = parseInt(process.env.BACKUP_RETRY_DELAY_MS || '5000');
    this.ensureTempDir();
  }

  private getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.VITE_SUPABASE_URL;
      const key = process.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) {
        throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in environment');
      }
      this.supabase = createClient(url, key);
    }
    return this.supabase;
  }

  async getRecentBackups(limit = 10): Promise<BackupLog[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('backup_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async getBackupLogs(limit = 50): Promise<BackupLog[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('backup_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`${operationName} failed (attempt ${attempt}/${this.retryAttempts}):`, error);
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay);
        }
      }
    }
    throw lastError;
  }

  async createBackupLog(type: 'manual' | 'automatic', createdBy: string): Promise<BackupLog> {
    const today = new Date().toISOString().split('T')[0];
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('backup_logs')
      .insert({
        type,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        backup_date: today,
        created_by: createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return data as BackupLog;
  }

  async updateBackupLog(
    id: string,
    updates: Partial<BackupLog>
  ): Promise<void> {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase
      .from('backup_logs')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  }

  async checkDuplicateBackup(date: string): Promise<BackupLog | null> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('backup_logs')
      .select('*')
      .eq('backup_date', date)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async exportDatabase(): Promise<{ data: Record<string, unknown>; exportedBytes: number }> {
    return this.withRetry(async () => {
      const supabase = this.getSupabaseClient();
      const tables = [
        'persons',
        'client_profiles',
        'payments',
        'subscriptions',
        'notifications',
        'messages',
        'message_reactions',
        'profile_interests',
        'profile_shortlists',
        'profile_views',
        'blocked_users',
        'user_reports',
        'user_roles',
        'notification_preferences',
        'push_subscriptions'
      ];

      const databaseExport: Record<string, unknown> = {};

      for (const table of tables) {
        const { data, error, count } = await this.getSupabaseClient()
          .from(table)
          .select('*', { count: 'exact' });

        if (error) {
          console.warn(`Warning: Could not export table ${table}:`, error);
          databaseExport[table] = { error: error.message, records: [] };
        } else {
          databaseExport[table] = {
            records: data || [],
            count: count || 0
          };
        }
      }

      const jsonString = JSON.stringify(databaseExport, null, 2);
      const exportedBytes = Buffer.byteLength(jsonString, 'utf8');

      console.log(`[BackupService] Database export completed: ${tables.length} tables, ${exportedBytes} bytes`);

      return { data: databaseExport, exportedBytes };
    }, 'Database export');
  }

  private async listFolderContents(bucketName: string, folderPath: string): Promise<{ name: string; isFolder: boolean; size: number; createdAt: string }[]> {
    const items: { name: string; isFolder: boolean; size: number; createdAt: string }[] = [];
    
    try {
      let offset = 0;
      let hasMore = true;
      const pageSize = MAX_PAGINATION_SIZE;
      
      const displayPath = folderPath || '(root)';
      console.log(`[BackupService] Listing ${bucketName}/${displayPath}...`);
      
      while (hasMore) {
        const { data: fileList, error } = await this.getSupabaseClient().storage
          .from(bucketName)
          .list(folderPath || undefined, { limit: pageSize, offset });

        if (error) {
          console.warn(`[BackupService] Could not list folder ${bucketName}/${displayPath}:`, error.message, JSON.stringify(error));
          return items;
        }

        if (!fileList || fileList.length === 0) {
          hasMore = false;
          continue;
        }

        console.log(`[BackupService] Listing page: offset=${offset}, count=${fileList.length}`);
        offset += fileList.length;
        hasMore = fileList.length === pageSize;

        for (const file of fileList) {
          if (!file.name) continue;

          const itemName = file.name;
          
          const isFolderMarker = itemName.endsWith('/');
          
          if (isFolderMarker) {
            items.push({
              name: itemName,
              isFolder: true,
              size: 0,
              createdAt: file.created_at || new Date().toISOString()
            });
            continue;
          }

          const fileSize = file.metadata?.size ?? 0;
          items.push({
            name: itemName,
            isFolder: false,
            size: fileSize,
            createdAt: file.created_at || new Date().toISOString()
          });
        }
      }

      console.log(`[BackupService] Found ${items.length} total items in ${bucketName}/${displayPath}`);
    } catch (err) {
      console.error(`[BackupService] Exception listing ${bucketName}/${folderPath || '(root)'}:`, err);
    }

    return items;
  }

  private async tryDownloadFirst(bucketName: string, itemPath: string): Promise<{ isFolder: boolean; size: number }> {
    const { data, error } = await this.getSupabaseClient().storage
      .from(bucketName)
      .download(itemPath);

    if (error || !data) {
      if (error?.message?.includes('Not Found') || error?.message?.includes('not found')) {
        const checkList = await this.getSupabaseClient().storage
          .from(bucketName)
          .list(itemPath, { limit: 1 });
        
        if (checkList.data && checkList.data.length > 0) {
          return { isFolder: true, size: 0 };
        }
      }
      return { isFolder: false, size: 0 };
    }

    if (data) {
      const arrayBuffer = await data.arrayBuffer();
      return { isFolder: false, size: arrayBuffer.byteLength };
    }

    return { isFolder: false, size: 0 };
  }

  private async collectAllFilesInBucket(bucketName: string): Promise<StorageFile[]> {
    const allFiles: StorageFile[] = [];
    const processedPaths = new Set<string>();

    console.log(`[BackupService] Starting collection from bucket: ${bucketName}`);

    const explorePath = async (folderPath: string): Promise<void> => {
      const pathKey = folderPath || '(root)';
      if (processedPaths.has(pathKey)) {
        console.log(`[BackupService] Already processed: ${pathKey}, skipping`);
        return;
      }
      processedPaths.add(pathKey);

      const displayPath = folderPath || '(root)';
      console.log(`[BackupService] Exploring ${bucketName}/${displayPath}...`);
      
      const items = await this.listFolderContents(bucketName, folderPath);
      console.log(`[BackupService] Found ${items.length} items in ${displayPath}`);

      if (items.length === 0) {
        console.log(`[BackupService] No items found in ${displayPath}`);
        return;
      }

      const foldersToExplore: string[] = [];

      for (const item of items) {
        if (item.isFolder) {
          const folderName = item.name;
          foldersToExplore.push(folderName);
          console.log(`[BackupService] Found explicit folder marker: ${folderName}`);
          continue;
        }

        const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;

        if (item.name.includes('/')) {
          const parts = item.name.split('/');
          const parentFolder = parts[0] + '/';
          if (!foldersToExplore.includes(parentFolder)) {
            foldersToExplore.push(parentFolder);
            console.log(`[BackupService] Found implicit folder from path: ${parentFolder}`);
          }
        }

        const downloadResult = await this.tryDownloadFirst(bucketName, fullPath);
        
        if (downloadResult.isFolder) {
          if (!foldersToExplore.includes(item.name + '/')) {
            foldersToExplore.push(item.name + '/');
            console.log(`[BackupService] Detected as folder via download check: ${item.name}/`);
          }
          continue;
        }

        if (downloadResult.size > 0) {
          console.log(`[BackupService] ✓ File confirmed: ${fullPath} (${downloadResult.size} bytes)`);
          allFiles.push({
            bucket_name: bucketName,
            path: fullPath,
            original_name: item.name,
            size: downloadResult.size,
            content_type: 'application/octet-stream',
            uploaded_at: item.createdAt
          });
        }
      }

      for (const folderName of foldersToExplore) {
        if (!folderName || folderName === '/') continue;
        const fullFolderPath = folderPath ? `${folderPath}/${folderName}` : folderName;
        console.log(`[BackupService] Exploring subfolder: ${fullFolderPath}`);
        await explorePath(fullFolderPath);
      }
    };

    await explorePath('');
    
    console.log(`[BackupService] Collected ${allFiles.length} files from bucket ${bucketName}`);
    if (allFiles.length > 0) {
      console.log(`[BackupService] Files collected:`, allFiles.map(f => `${f.bucket_name}/${f.path} (${f.size} bytes)`));
    }
    return allFiles;
  }

  async collectStorageFiles(): Promise<{ files: StorageFile[]; totalExpectedSize: number; bucketsFound: string[] }> {
    console.log(`[BackupService] collectStorageFiles: Starting with STORAGE_BUCKETS=`, STORAGE_BUCKETS);
    return this.withRetry(async () => {
      const allFiles: StorageFile[] = [];
      let totalExpectedSize = 0;
      const bucketsFound: string[] = [];

      for (const bucketName of STORAGE_BUCKETS) {
        console.log(`[BackupService] Processing bucket: ${bucketName}`);
        const bucketFiles = await this.collectAllFilesInBucket(bucketName);
        console.log(`[BackupService] Bucket ${bucketName} returned ${bucketFiles.length} files`);
        
        if (bucketFiles.length > 0) {
          bucketsFound.push(bucketName);
          const bucketSize = bucketFiles.reduce((sum, f) => sum + f.size, 0);
          totalExpectedSize += bucketSize;
          allFiles.push(...bucketFiles);
          console.log(`[BackupService] Bucket ${bucketName}: ${bucketFiles.length} files, ${bucketSize} bytes`);
        }
      }

      console.log(`[BackupService] FINAL Storage files collected: ${allFiles.length} files across ${bucketsFound.length} buckets, ${totalExpectedSize} total bytes expected`);
      console.log(`[BackupService] All files:`, allFiles);
      return { files: allFiles, totalExpectedSize, bucketsFound };
    }, 'Storage file collection');
  }

  async downloadFile(bucketName: string, filePath: string): Promise<{ buffer: Buffer | null; actualSize: number; error?: string }> {
    if (!filePath || filePath.endsWith('/')) {
      console.log(`[BackupService] Skipping folder path: ${filePath}`);
      return { buffer: null, actualSize: 0, error: 'Skipping folder path' };
    }
    
    console.log(`[BackupService] Attempting download: ${bucketName}/${filePath}`);
    
    return this.withRetry(async () => {
      try {
        const { data, error } = await this.getSupabaseClient().storage
          .from(bucketName)
          .download(filePath);

        console.log(`[BackupService] Download response for ${filePath}: error=`, error, ', data=', data ? `Blob(${data.size})` : 'null');

        if (error || !data) {
          const errorMsg = error?.message || 'Download failed';
          console.warn(`[BackupService] Download failed for ${filePath}: ${errorMsg}`);
          if (errorMsg.includes('Not Found') || errorMsg.includes('not found')) {
            return { buffer: null, actualSize: 0, error: `Object not found: ${filePath}` };
          }
          return { buffer: null, actualSize: 0, error: errorMsg };
        }

        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const actualSize = buffer.length;

        console.log(`[BackupService] Successfully downloaded ${filePath}: ${actualSize} bytes`);
        return { buffer, actualSize };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[BackupService] Exception downloading ${filePath}:`, errorMessage);
        return { buffer: null, actualSize: 0, error: errorMessage };
      }
    }, `File download: ${bucketName}/${filePath}`);
  }

  async collectExternalImages(): Promise<ExternalImage[]> {
    const externalImages: ExternalImage[] = [];

    const supabase = this.getSupabaseClient();
    const { data: profiles, error } = await supabase
      .from('client_profiles')
      .select('id, profile_photo, gallery_images');

    if (error) {
      console.warn('Warning: Could not fetch profiles for external images:', error);
      return externalImages;
    }

    for (const profile of profiles || []) {
      if (profile.profile_photo && profile.profile_photo.startsWith('http')) {
        externalImages.push({
          url: profile.profile_photo,
          profile_id: profile.id,
          field: 'profile_photo'
        });
      }

      if (profile.gallery_images) {
        for (const url of profile.gallery_images) {
          if (url && typeof url === 'string' && url.startsWith('http')) {
            externalImages.push({
              url,
              profile_id: profile.id,
              field: 'gallery_images'
            });
          }
        }
      }
    }

    console.log(`[BackupService] External images collected: ${externalImages.length} URLs`);
    return externalImages;
  }

  async validateArchiveContents(archivePath: string, expectedFiles: string[]): Promise<ArchiveValidation> {
    const validation: ArchiveValidation = {
      is_valid: false,
      is_complete: false,
      files_in_archive: [],
      expected_files: expectedFiles,
      missing_files: [],
      warnings: []
    };

    const AdmZip = (await import('adm-zip')).default;

    try {
      const archiveStats = fs.statSync(archivePath);
      validation.is_valid = archiveStats.size > 0;

      if (archiveStats.size === 0) {
        validation.warnings.push('Archive file is empty');
        return validation;
      }

      const zip = new AdmZip(archivePath);
      const zipEntries = zip.getEntries();
      validation.files_in_archive = zipEntries.map(e => e.entryName);

      const criticalFiles = ['database-export.json', 'backup-manifest.json', 'RESTORE_README.md'];
      const missingCritical = criticalFiles.filter(f => !validation.files_in_archive.includes(f));
      
      if (missingCritical.length > 0) {
        validation.missing_files.push(...missingCritical);
        validation.warnings.push(`Missing critical files: ${missingCritical.join(', ')}`);
      }

      const hasStorage = validation.files_in_archive.some(f => f.startsWith('storage/'));
      if (expectedFiles.some(f => f.startsWith('storage/')) && !hasStorage) {
        validation.warnings.push('No storage files included in archive');
      }

      validation.is_complete = missingCritical.length === 0 && validation.is_valid;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      validation.warnings.push(`Archive validation failed: ${errorMessage}`);
    }

    return validation;
  }

  async createBackupArchive(
    databaseExport: Record<string, unknown>,
    storageFiles: StorageFile[],
    onProgress: (progress: BackupProgress) => void,
    readmeContent?: string,
    manifestJson?: string
  ): Promise<ArchiveResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(this.tempDir, `backup-${timestamp}.zip`);
    const output = fs.createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const archiveComplete = new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve());
      archive.on('error', (err: Error) => reject(err));
    });

    archive.pipe(output);

    const bucketResults: Map<string, BucketBackupResult> = new Map();
    const filesMissing: string[] = [];
    const filesInArchive: string[] = [];
    let storageSize = 0;
    let filesProcessed = 0;
    let filesIncluded = 0;
    let totalExpectedSize = 0;

    for (const bucketName of STORAGE_BUCKETS) {
      bucketResults.set(bucketName, {
        bucket_name: bucketName,
        files_expected: 0,
        files_included: 0,
        files_missing: [],
        total_expected_size: 0,
        total_included_size: 0,
        files: []
      });
    }

    const jsonString = JSON.stringify(databaseExport, null, 2);
    const databaseSize = Buffer.byteLength(jsonString, 'utf8');

    onProgress({ stage: 'creating_archive', progress: 5, message: 'Adding database export to archive...' });
    archive.append(jsonString, { name: 'database-export.json' });
    filesInArchive.push('database-export.json');
    console.log(`[BackupService] Added database export: ${databaseSize} bytes`);

    const bucketFiles = storageFiles.filter(f => f.bucket_name);
    const totalFiles = bucketFiles.length;
    totalExpectedSize = bucketFiles.reduce((sum, f) => sum + f.size, 0);

    console.log(`[BackupService] Starting storage backup: ${totalFiles} files to process`);
    console.log(`[BackupService] Files to download:`, bucketFiles.map(f => `${f.bucket_name}/${f.path}`).slice(0, 10).join(', '), totalFiles > 10 ? '...' : '');

    onProgress({ 
      stage: 'creating_archive', 
      progress: 10, 
      message: `Starting storage backup: ${totalFiles} files...`,
      filesProcessed: 0,
      filesTotal: totalFiles,
      bytesProcessed: 0
    });

    for (const file of bucketFiles) {
      filesProcessed++;
      
      const { buffer, actualSize, error } = await this.downloadFile(file.bucket_name, file.path);

      const bucketResult = bucketResults.get(file.bucket_name)!;
      bucketResult.files_expected++;
      bucketResult.total_expected_size += file.size;

      const bucketFile: BucketFile = {
        bucket_name: file.bucket_name,
        path: file.path,
        original_name: file.original_name,
        size: file.size,
        actual_size: actualSize,
        content_type: file.content_type,
        uploaded_at: file.uploaded_at,
        downloaded: false,
        download_error: error
      };

      if (buffer && actualSize > 0) {
        const archivePathInZip = `storage/${file.bucket_name}/${file.path}`;
        archive.append(buffer, { name: archivePathInZip });
        storageSize += actualSize;
        filesIncluded++;
        filesInArchive.push(archivePathInZip);
        bucketResult.files_included++;
        bucketResult.total_included_size += actualSize;
        bucketFile.downloaded = true;
        bucketFile.actual_size = actualSize;
        
        if (filesProcessed <= 5 || filesProcessed === totalFiles) {
          console.log(`[BackupService] ✓ Added: ${archivePathInZip} (${actualSize} bytes)`);
        }
      } else {
        filesMissing.push(`${file.bucket_name}/${file.path}`);
        bucketResult.files_missing.push(file.path);
        console.warn(`[BackupService] ✗ MISSING: ${file.bucket_name}/${file.path} - ${error || 'No data'}`);
      }

      bucketResult.files.push(bucketFile);

      if (filesProcessed % 10 === 0 || filesProcessed === totalFiles) {
        console.log(`[BackupService] Progress: ${filesProcessed}/${totalFiles} files processed, ${filesIncluded} included, ${storageSize} bytes`);
      }

      const progress = 10 + Math.round((filesProcessed / totalFiles) * 55);
      onProgress({ 
        stage: 'creating_archive', 
        progress, 
        message: `Processing: ${filesProcessed}/${totalFiles}...`,
        filesProcessed,
        filesTotal: totalFiles,
        bytesProcessed: storageSize
      });
    }

    onProgress({ stage: 'creating_archive', progress: 70, message: 'Finalizing archive...' });

    if (readmeContent) {
      archive.append(readmeContent, { name: 'RESTORE_README.md' });
      filesInArchive.push('RESTORE_README.md');
      console.log(`[BackupService] Added RESTORE_README.md to archive`);
    }

    if (manifestJson) {
      archive.append(manifestJson, { name: 'backup-manifest.json' });
      filesInArchive.push('backup-manifest.json');
      console.log(`[BackupService] Added backup-manifest.json to archive`);
    }

    archive.finalize();
    await archiveComplete;

    const archiveStats = fs.statSync(archivePath);
    const totalArchiveSize = archiveStats.size;

    console.log(`[BackupService] Archive finalized: ${totalArchiveSize} bytes`);
    console.log(`[BackupService] Storage summary: ${filesIncluded}/${totalFiles} files included, ${storageSize} bytes`);
    console.log(`[BackupService] Missing files: ${filesMissing.length}`);

    for (const [bucketName, result] of bucketResults) {
      if (result.files_expected > 0) {
        console.log(`[BackupService] Bucket ${bucketName}: ${result.files_included}/${result.files_expected} files, ${result.total_included_size} bytes`);
      }
    }

    const bucketResultsArray = Array.from(bucketResults.values()).filter(b => b.files_expected > 0);

    return {
      archivePath,
      totalSize: totalArchiveSize,
      databaseSize,
      storageSize,
      filesProcessed,
      filesIncluded,
      filesMissing,
      bucketResults: bucketResultsArray,
      totalExpectedSize,
      totalIncludedSize: storageSize,
      filesInArchive
    };
  }

  calculateCompleteness(bucketResults: BucketBackupResult[]): CompletenessStatus {
    const totalExpected = bucketResults.reduce((sum, b) => sum + b.files_expected, 0);
    const totalIncluded = bucketResults.reduce((sum, b) => sum + b.files_included, 0);
    const totalMissing = bucketResults.reduce((sum, b) => sum + b.files_missing.length, 0);

    const hasDownloadErrors = bucketResults.some(b => b.files.some(f => f.download_error && !f.downloaded));
    const hasMissingFiles = totalMissing > 0;
    const hasWarnings = hasDownloadErrors || hasMissingFiles;

    if (totalExpected === 0) {
      return 'db_only';
    }
    
    if (totalIncluded === totalExpected && !hasWarnings) {
      return 'fully_restorable';
    }
    
    if (totalIncluded > 0) {
      return 'partially_restorable';
    }
    
    return 'db_only';
  }

  async createManifest(
    backupDate: string,
    type: 'manual' | 'automatic',
    createdBy: string,
    databaseExport: Record<string, unknown>,
    storageFiles: StorageFile[],
    externalImages: ExternalImage[],
    archiveResult: ArchiveResult,
    archiveValidation: ArchiveValidation
  ): Promise<BackupManifest> {
    const tableNames = Object.keys(databaseExport);
    const recordCounts: Record<string, number> = {};

    for (const table of tableNames) {
      const tableData = databaseExport[table] as { count?: number };
      recordCounts[table] = tableData.count || 0;
    }

    const completeness = this.calculateCompleteness(archiveResult.bucketResults);
    const isFullRestorable = completeness === 'fully_restorable';

    const warnings: string[] = [];
    
    if (archiveResult.filesMissing.length > 0) {
      warnings.push(`${archiveResult.filesMissing.length} storage files could not be downloaded`);
    }
    
    if (archiveResult.storageSize < archiveResult.totalExpectedSize) {
      const sizeDiff = archiveResult.totalExpectedSize - archiveResult.storageSize;
      warnings.push(`Storage size mismatch: expected ${archiveResult.totalExpectedSize}, got ${archiveResult.storageSize} (difference: ${sizeDiff})`);
    }

    if (!archiveValidation.is_complete) {
      warnings.push(`Archive validation: ${archiveValidation.missing_files.length} files missing from archive`);
    }

    const totalFilesExpected = archiveResult.bucketResults.reduce((sum, b) => sum + b.files_expected, 0);
    const totalFilesIncluded = archiveResult.bucketResults.reduce((sum, b) => sum + b.files_included, 0);
    const totalFilesMissing = archiveResult.bucketResults.reduce((sum, b) => sum + b.files_missing.length, 0);

    const manifest: BackupManifest = {
      backup_version: BACKUP_VERSION,
      backup_date: backupDate,
      backup_type: type,
      created_by: createdBy,
      completeness,
      is_full_restorable: isFullRestorable,
      database: {
        export_time: new Date().toISOString(),
        tables: tableNames,
        record_counts: recordCounts,
        exported_bytes: archiveResult.databaseSize
      },
      storage: {
        buckets: archiveResult.bucketResults,
        total_files_expected: totalFilesExpected,
        total_files_included: totalFilesIncluded,
        total_files_missing: totalFilesMissing,
        total_expected_size: archiveResult.totalExpectedSize,
        total_included_size: archiveResult.totalIncludedSize
      },
      external_images: externalImages,
      archive: {
        total_size: archiveResult.totalSize,
        database_only_size: archiveResult.databaseSize,
        storage_included_size: archiveResult.storageSize,
        file_count_in_archive: archiveResult.filesInArchive.length
      },
      validation: {
        is_valid: archiveValidation.is_valid,
        is_complete: archiveValidation.is_complete,
        missing_files_report: archiveValidation.missing_files,
        warnings: [...warnings, ...archiveValidation.warnings],
        validated_at: new Date().toISOString()
      }
    };

    console.log(`[BackupService] === MANIFEST CREATED ===`);
    console.log(`[BackupService] completeness: ${completeness}`);
    console.log(`[BackupService] is_full_restorable: ${isFullRestorable}`);
    console.log(`[BackupService] total_files_expected: ${totalFilesExpected}`);
    console.log(`[BackupService] total_files_included: ${totalFilesIncluded}`);
    console.log(`[BackupService] total_files_missing: ${totalFilesMissing}`);
    console.log(`[BackupService] total_included_size: ${archiveResult.totalIncludedSize}`);
    console.log(`[BackupService] file_count_in_archive: ${archiveResult.filesInArchive.length}`);
    console.log(`[BackupService] =========================`);

    return manifest;
  }

  async uploadToGoogleDrive(
    filePath: string,
    folderId: string,
    backupDate: string,
    onProgress: (progress: BackupProgress) => void
  ): Promise<string> {
    return this.withRetry(async () => {
      const { google } = await import('googleapis');

      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(fs.readFileSync(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH!, 'utf8')),
        scopes: ['https://www.googleapis.com/auth/drive.file']
      });

      const drive = google.drive({ version: 'v3', auth });

      const fileName = `backup-${backupDate}.zip`;
      const fileSize = fs.statSync(filePath).size;

      const createResponse = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
          mimeType: 'application/zip'
        },
        media: {
          body: fs.createReadStream(filePath)
        }
      });

      const fileId = createResponse.data.id!;
      onProgress({
        stage: 'uploading',
        progress: 95,
        message: 'Verifying upload...'
      });

      const verifyResponse = await drive.files.get({
        fileId,
        fields: 'name, size, createdTime'
      });

      console.log(`Uploaded backup file: ${verifyResponse.data.name}, Size: ${verifyResponse.data.size}, ID: ${fileId}`);

      return fileId;
    }, 'Google Drive upload');
  }

  async cleanupTempFiles(...filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      if (!filePath || typeof filePath !== 'string' || filePath.length === 0) {
        console.warn(`[BackupService] Skipping cleanup: invalid path ${filePath}`);
        continue;
      }
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[BackupService] Cleaned up temp file: ${filePath}`);
        }
      } catch (error) {
        console.warn(`[BackupService] Could not delete temp file ${filePath}:`, error);
      }
    }
  }

  async injectManifestIntoArchive(archivePath: string, manifest: BackupManifest, readmeContent?: string): Promise<string> {
    const AdmZip = (await import('adm-zip')).default;
    const tempDir = path.join(this.tempDir, `inject-${Date.now()}`);
    
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      
      const zip = new AdmZip(archivePath);
      zip.extractAllTo(tempDir, true);
      console.log(`[BackupService] Extracted archive to ${tempDir} for manifest injection`);
      
      const manifestPath = path.join(tempDir, 'backup-manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`[BackupService] Added manifest to extracted folder`);
      
      if (readmeContent) {
        const readmePath = path.join(tempDir, 'RESTORE_README.md');
        fs.writeFileSync(readmePath, readmeContent);
        console.log(`[BackupService] Updated RESTORE_README.md in extracted folder`);
      }
      
      const newZipPath = archivePath.replace('.zip', '-final.zip');
      const newZip = new AdmZip();
      
      const addFolderRecursive = (dir: string, basePath: string = '') => {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const relativePath = path.join(basePath, entry);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            addFolderRecursive(fullPath, relativePath);
          } else {
            newZip.addLocalFile(fullPath, basePath ? path.dirname(relativePath) : '.');
          }
        }
      };
      
      addFolderRecursive(tempDir);
      newZip.writeZip(newZipPath);
      console.log(`[BackupService] Created final archive with manifest: ${newZipPath}`);
      
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(archivePath);
      fs.renameSync(newZipPath, archivePath);
      console.log(`[BackupService] Replaced original archive with final version`);
      
      return archivePath;
    } catch (error) {
      console.error(`[BackupService] Failed to inject manifest:`, error);
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  async enforceRetentionPolicy(driveFolderId: string): Promise<number> {
    const { google } = await import('googleapis');

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(fs.readFileSync(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH!, 'utf8')),
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });

    const listResponse = await drive.files.list({
      q: `'${driveFolderId}' in parents and mimeType='application/zip'`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime asc'
    });

    const files = listResponse.data.files || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    const cutoffISO = cutoffDate.toISOString();

    let deletedCount = 0;
    for (const file of files) {
      if (file.createdTime && file.createdTime < cutoffISO) {
        try {
          await drive.files.delete({ fileId: file.id! });
          deletedCount++;
          console.log(`[BackupService] Deleted old backup: ${file.name} (${file.createdTime})`);
        } catch (error) {
          console.warn(`[BackupService] Could not delete old backup ${file.id}:`, error);
        }
      }
    }

    return deletedCount;
  }

  generateRestoreReadme(manifest: BackupManifest): string {
    const templatePath = path.join(process.cwd(), 'src', 'scripts', 'RESTORE_README.md');
    let template: string;

    try {
      template = fs.readFileSync(templatePath, 'utf8');
    } catch {
      console.warn(`[BackupService] RESTORE_README.md template not found at ${templatePath}, using minimal template`);
      template = this.getMinimalReadmeTemplate();
    }

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
      .replace(/\{\{TOOL_VERSION\}\}/g, BACKUP_VERSION)
      .replace(/\{\{GENERATED_AT\}\}/g, new Date().toISOString());
  }

  private getMinimalReadmeTemplate(): string {
    return `# Backup Restore Guide

## Backup Information
- **Backup Version**: {{BACKUP_VERSION}}
- **Backup Date**: {{BACKUP_DATE}}
- **Backup Type**: {{BACKUP_TYPE}}
- **Completeness**: {{COMPLETENESS_STATUS}}

## Contents
This archive contains database records and storage files for disaster recovery.

## Restore Steps
1. Extract this ZIP to a local directory
2. Configure environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
3. Run: npm run restore:local -- --file ./backup-{{BACKUP_DATE}}.zip

For full instructions, see the main RESTORE_README.md in the server/scripts directory.
`;
  }
}

export const backupService = new BackupService();