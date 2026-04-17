import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import archiver from 'archiver';
import { BackupProgress } from '../types/index.js';

export interface GoogleDriveBackupConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  redirectUri: string;
  folderId: string;
  tempDir?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  includeStorage?: boolean;
}

export interface GoogleDriveBackupResult {
  success: boolean;
  backupDate: string;
  archivePath: string;
  archiveSize: number;
  driveFileId?: string;
  driveFileName?: string;
  driveFileSize?: number;
  uploadedAt?: string;
  databaseExportedBytes: number;
  storageExportedBytes: number;
  filesProcessed: number;
  error?: string;
}

export class GoogleDriveBackupService {
  private supabase: SupabaseClient | null = null;
  private drive: drive_v3.Drive | null = null;
  private config: GoogleDriveBackupConfig;
  private tempDir: string;
  private maxRetries: number;
  private retryDelayMs: number;
  private STORAGE_BUCKETS = ['person-images', 'attachments', 'profile-assets', 'chat-files'];

  constructor() {
    this.config = this.loadConfig();
    this.tempDir = this.resolveTempDir();
    this.maxRetries = this.config.maxRetries || 3;
    this.retryDelayMs = this.config.retryDelayMs || 5000;
  }

  private loadConfig(): GoogleDriveBackupConfig {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/oauth2callback';
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!clientId || !clientSecret || !refreshToken || !folderId) {
      throw new Error('Google Drive OAuth credentials not configured. Check environment variables: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID');
    }

    return {
      clientId,
      clientSecret,
      refreshToken,
      redirectUri,
      folderId,
      tempDir: process.env.BACKUP_TEMP_DIR,
      maxRetries: parseInt(process.env.BACKUP_RETRY_ATTEMPTS || '3'),
      retryDelayMs: parseInt(process.env.BACKUP_RETRY_DELAY_MS || '5000'),
      includeStorage: process.env.BACKUP_INCLUDE_STORAGE !== 'false'
    };
  }

  private resolveTempDir(): string {
    let targetDir: string;

    const osTempDir = os.tmpdir();
    if (osTempDir && osTempDir !== '/tmp' && osTempDir !== '\\Temp') {
      targetDir = path.join(osTempDir, 'matrimony-backups');
    } else {
      targetDir = path.join(process.cwd(), 'temp-backups');
    }

    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`[GoogleDriveBackup] Created temp directory: ${targetDir}`);
      } catch (error) {
        console.warn(`[GoogleDriveBackup] Could not create ${targetDir}, falling back to ./temp-backups`);
        targetDir = path.join(process.cwd(), 'temp-backups');
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
      }
    }

    return targetDir;
  }

  private getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
      }
      this.supabase = createClient(url, key);
    }
    return this.supabase;
  }

  private getDriveClient(): drive_v3.Drive {
    if (!this.drive) {
      const oauth2 = new google.auth.OAuth2(
        this.config.clientId,
        this.config.clientSecret,
        this.config.redirectUri
      );
      oauth2.setCredentials({ refresh_token: this.config.refreshToken });
      this.drive = google.drive({ version: 'v3', auth: oauth2 });
    }
    return this.drive;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[GoogleDriveBackup] ${operationName} - attempt ${attempt}/${this.maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`[GoogleDriveBackup] ${operationName} failed (attempt ${attempt}/${this.maxRetries}):`, error);

        if (attempt < this.maxRetries) {
          console.log(`[GoogleDriveBackup] Waiting ${this.retryDelayMs}ms before retry...`);
          await this.delay(this.retryDelayMs);
        }
      }
    }

    throw lastError;
  }

  async exportDatabase(): Promise<{ data: Record<string, unknown>; exportedBytes: number }> {
    console.log('[GoogleDriveBackup] Step 1: Creating database export...');
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
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' });

      if (error) {
        console.warn(`[GoogleDriveBackup] Warning: Could not export table ${table}:`, error.message);
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

    console.log(`[GoogleDriveBackup] Database export completed: ${tables.length} tables, ${exportedBytes} bytes`);

    return { data: databaseExport, exportedBytes };
  }

  async collectAndDownloadStorageFiles(): Promise<{ files: Map<string, Buffer>; totalBytes: number; fileCount: number }> {
    console.log('[GoogleDriveBackup] Step 1b: Collecting storage files...');

    const fileBuffers = new Map<string, Buffer>();
    let totalBytes = 0;
    let fileCount = 0;

    if (!this.config.includeStorage) {
      console.log('[GoogleDriveBackup] Storage backup disabled, skipping...');
      return { files: fileBuffers, totalBytes, fileCount };
    }

    const supabase = this.getSupabaseClient();

    for (const bucketName of this.STORAGE_BUCKETS) {
      try {
        let offset = 0;
        let hasMore = true;
        const pageSize = 100;

        while (hasMore) {
          const { data: fileList, error } = await supabase.storage
            .from(bucketName)
            .list(undefined, { limit: pageSize, offset });

          if (error) {
            console.warn(`[GoogleDriveBackup] Could not list bucket ${bucketName}:`, error.message);
            break;
          }

          if (!fileList || fileList.length === 0) {
            hasMore = false;
            continue;
          }

          offset += fileList.length;
          hasMore = fileList.length === pageSize;

          for (const file of fileList) {
            if (!file.name || file.name.endsWith('/')) continue;

            try {
              const { data: fileData, error: downloadError } = await supabase.storage
                .from(bucketName)
                .download(file.name);

              if (downloadError || !fileData) {
                console.warn(`[GoogleDriveBackup] Could not download ${bucketName}/${file.name}`);
                continue;
              }

              const arrayBuffer = await fileData.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const key = `storage/${bucketName}/${file.name}`;
              fileBuffers.set(key, buffer);
              totalBytes += buffer.length;
              fileCount++;
            } catch (err) {
              console.warn(`[GoogleDriveBackup] Error downloading ${bucketName}/${file.name}:`, err);
            }
          }
        }

        console.log(`[GoogleDriveBackup] Bucket ${bucketName}: ${fileCount} files collected`);
      } catch (err) {
        console.warn(`[GoogleDriveBackup] Error processing bucket ${bucketName}:`, err);
      }
    }

    console.log(`[GoogleDriveBackup] Storage collection complete: ${fileCount} files, ${totalBytes} bytes`);

    return { files: fileBuffers, totalBytes, fileCount };
  }

  async createBackupArchive(
    databaseExport: Record<string, unknown>,
    storageFiles: Map<string, Buffer>,
    onProgress?: (progress: BackupProgress) => void
  ): Promise<{ archivePath: string; archiveSize: number; databaseSize: number; storageSize: number }> {
    console.log('[GoogleDriveBackup] Step 2: Creating ZIP archive...');

    if (onProgress) {
      onProgress({ stage: 'creating_archive', progress: 20, message: 'Creating ZIP archive...' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join(this.tempDir, `backup-${timestamp}.zip`);

    const jsonString = JSON.stringify(databaseExport, null, 2);
    const databaseSize = Buffer.byteLength(jsonString, 'utf8');

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      let archiveStorageSize = 0;

      output.on('close', async () => {
        const archiveSize = archive.pointer();
        console.log(`[GoogleDriveBackup] Archive created: ${archivePath} (${archiveSize} bytes)`);

        if (onProgress) {
          onProgress({ stage: 'creating_archive', progress: 40, message: 'Archive created successfully' });
        }

        resolve({
          archivePath,
          archiveSize,
          databaseSize,
          storageSize: archiveStorageSize
        });
      });

      archive.on('error', (err: Error) => {
        console.error('[GoogleDriveBackup] Archive error:', err);
        reject(err);
      });

      archive.pipe(output);

      archive.append(jsonString, { name: 'database-export.json' });
      console.log('[GoogleDriveBackup] Added database-export.json to archive');

      for (const [, buffer] of storageFiles) {
        archiveStorageSize += buffer.length;
      }

      const manifest = {
        backup_version: '1.0.0',
        backup_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        database_size: databaseSize,
        storage_size: archiveStorageSize,
        storage_files_count: storageFiles.size
      };
      archive.append(JSON.stringify(manifest, null, 2), { name: 'backup-manifest.json' });
      console.log('[GoogleDriveBackup] Added backup-manifest.json to archive');

      for (const [filePath, buffer] of storageFiles) {
        archive.append(buffer, { name: filePath });
      }
      console.log(`[GoogleDriveBackup] Added ${storageFiles.size} storage files to archive`);

      archive.finalize();
    });
  }

  async uploadToGoogleDrive(
    archivePath: string,
    backupDate: string,
    onProgress?: (progress: BackupProgress) => void
  ): Promise<{ driveFileId: string; driveFileName: string; driveFileSize: number; uploadedAt: string }> {
    console.log('[GoogleDriveBackup] Step 3: Uploading to Google Drive...');

    if (onProgress) {
      onProgress({ stage: 'uploading', progress: 50, message: 'Uploading to Google Drive...' });
    }

    const fileStats = fs.statSync(archivePath);
    const localSize = fileStats.size;
    const fileName = `backup-${backupDate}.zip`;

    return this.withRetry(async () => {
      const drive = this.getDriveClient();

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [this.config.folderId],
          mimeType: 'application/zip'
        },
        media: {
          body: fs.createReadStream(archivePath)
        },
        fields: 'id, name, size, createdTime'
      });

      if (!response.data.id) {
        throw new Error(`Upload failed: No file ID returned`);
      }

      const driveFileId = response.data.id;
      const driveFileName = response.data.name || fileName;
      const driveFileSize = response.data.size ? parseInt(String(response.data.size), 10) : localSize;
      const uploadedAt = response.data.createdTime || new Date().toISOString();

      console.log(`[GoogleDriveBackup] Uploaded: ${driveFileName}, Local: ${localSize}, Drive: ${driveFileSize}, ID: ${driveFileId}`);

      if (driveFileSize < localSize * 0.95) {
        console.warn(`[GoogleDriveBackup] WARNING: Drive file size (${driveFileSize}) significantly less than local (${localSize})`);
      }

      if (onProgress) {
        onProgress({ stage: 'uploading', progress: 80, message: 'Verifying upload...' });
      }

      const verifyResponse = await drive.files.get({
        fileId: driveFileId,
        fields: 'id, name, size, createdTime'
      });

      if (!verifyResponse.data.id) {
        throw new Error(`Verification failed: File ID mismatch`);
      }

      const verifiedSize = verifyResponse.data.size ? parseInt(String(verifyResponse.data.size), 10) : 0;
      if (verifiedSize > 0 && Math.abs(verifiedSize - driveFileSize) > 100) {
        console.warn(`[GoogleDriveBackup] Size mismatch warning: Drive=${verifiedSize}, Local=${driveFileSize}`);
      }

      console.log(`[GoogleDriveBackup] Upload verified successfully: ${driveFileId}`);

      return {
        driveFileId,
        driveFileName,
        driveFileSize,
        uploadedAt
      };
    }, 'Google Drive upload');
  }

  async safeDeleteLocalFile(filePath: string): Promise<void> {
    console.log('[GoogleDriveBackup] Step 4: Cleaning up local file...');

    if (!filePath || typeof filePath !== 'string' || filePath.length === 0) {
      console.warn('[GoogleDriveBackup] Invalid file path, skipping cleanup');
      return;
    }

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[GoogleDriveBackup] Deleted local file: ${filePath}`);
      } else {
        console.log(`[GoogleDriveBackup] File does not exist, skipping: ${filePath}`);
      }
    } catch (error) {
      console.warn(`[GoogleDriveBackup] Could not delete local file ${filePath}:`, error);
    }
  }

  async executeBackup(
    onProgress?: (progress: BackupProgress) => void
  ): Promise<GoogleDriveBackupResult> {
    console.log('[GoogleDriveBackup] ===== Starting Google Drive Backup =====');
    const backupDate = new Date().toISOString().split('T')[0];
    let archivePath = '';
    let databaseExportedBytes = 0;
    let storageExportedBytes = 0;
    let filesProcessed = 0;

    try {
      if (onProgress) {
        onProgress({ stage: 'initializing', progress: 0, message: 'Initializing backup...' });
      }

      console.log(`[GoogleDriveBackup] Backup date: ${backupDate}`);
      console.log(`[GoogleDriveBackup] Temp directory: ${this.tempDir}`);

      if (onProgress) {
        onProgress({ stage: 'exporting_database', progress: 10, message: 'Exporting database...' });
      }

      const { exportedBytes } = await this.exportDatabase();
      databaseExportedBytes = exportedBytes;

      let storageFiles = new Map<string, Buffer>();
      if (this.config.includeStorage) {
        if (onProgress) {
          onProgress({ stage: 'collecting_files', progress: 15, message: 'Collecting storage files...' });
        }
        const { files, totalBytes, fileCount } = await this.collectAndDownloadStorageFiles();
        storageFiles = files;
        storageExportedBytes = totalBytes;
        filesProcessed = fileCount;
      }

      if (onProgress) {
        onProgress({ stage: 'creating_archive', progress: 30, message: 'Creating archive...' });
      }

      const dbExport = await this.exportDatabase();
      databaseExportedBytes = dbExport.exportedBytes;

      if (onProgress) {
        onProgress({ stage: 'creating_archive', progress: 30, message: 'Creating archive...' });
      }

      const { archivePath: zipPath, archiveSize } = await this.createBackupArchive(
        dbExport.data,
        storageFiles,
        onProgress
      );
      archivePath = zipPath;

      const { driveFileId, driveFileName, driveFileSize, uploadedAt } = await this.uploadToGoogleDrive(
        archivePath,
        backupDate,
        onProgress
      );

      await this.safeDeleteLocalFile(archivePath);

      if (onProgress) {
        onProgress({ stage: 'completed', progress: 100, message: 'Backup completed successfully' });
      }

      console.log('[GoogleDriveBackup] ===== Backup completed successfully =====');

      return {
        success: true,
        backupDate,
        archivePath,
        archiveSize,
        driveFileId,
        driveFileName,
        driveFileSize,
        uploadedAt,
        databaseExportedBytes,
        storageExportedBytes,
        filesProcessed
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[GoogleDriveBackup] Backup failed: ${errorMessage}`);

      if (archivePath) {
        console.log('[GoogleDriveBackup] Preserving local file for retry due to upload failure');
      }

      if (onProgress) {
        onProgress({ stage: 'failed', progress: 0, message: 'Backup failed', error: errorMessage });
      }

      return {
        success: false,
        backupDate,
        archivePath,
        archiveSize: 0,
        databaseExportedBytes,
        storageExportedBytes,
        filesProcessed,
        error: errorMessage
      };
    }
  }

  async cleanupOldBackups(retentionDays: number): Promise<number> {
    console.log(`[GoogleDriveBackup] Cleaning up backups older than ${retentionDays} days`);

    return this.withRetry(async () => {
      const drive = this.getDriveClient();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const response = await drive.files.list({
        q: `'${this.config.folderId}' in parents and mimeType='application/zip'`,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime asc'
      });

      const files = response.data.files || [];
      let deletedCount = 0;

      for (const file of files) {
        if (file.createdTime) {
          const fileDate = new Date(file.createdTime);
          if (fileDate < cutoffDate) {
            try {
              await drive.files.delete({ fileId: file.id! });
              deletedCount++;
              console.log(`[GoogleDriveBackup] Deleted old backup: ${file.name}`);
            } catch (err) {
              console.warn(`[GoogleDriveBackup] Could not delete ${file.name}:`, err);
            }
          }
        }
      }

      console.log(`[GoogleDriveBackup] Deleted ${deletedCount} old backups`);

      return deletedCount;
    }, 'Cleanup old backups');
  }

  async listBackups(): Promise<{ id: string; name: string; size: number; createdTime: string }[]> {
    return this.withRetry(async () => {
      const drive = this.getDriveClient();

      const response = await drive.files.list({
        q: `'${this.config.folderId}' in parents and mimeType='application/zip'`,
        fields: 'files(id, name, size, createdTime)',
        orderBy: 'createdTime desc'
      });

      return (response.data.files || []).map(file => ({
        id: file.id!,
        name: file.name!,
        size: file.size ? parseInt(String(file.size), 10) : 0,
        createdTime: file.createdTime!
      }));
    }, 'List backups');
  }

  resetDriveClient(): void {
    this.drive = null;
  }
}

export const googleDriveBackupService = new GoogleDriveBackupService();