import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { google, drive_v3 } from 'googleapis';
import fs from 'fs';

const BACKUP_RETENTION_COUNT = parseInt(process.env.BACKUP_RETENTION_COUNT || '7');

export interface DriveBackupFile {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  mimeType: string;
}

export interface DriveBackupFolder {
  id: string;
  name: string;
  createdTime: string;
}

export interface RetentionCleanupResult {
  success: boolean;
  keptBackups: number;
  deletedBackups: number;
  deletedFiles: DriveBackupFile[];
  errors: string[];
  timestamp: string;
}

export interface BackupLogEntry {
  id: string;
  backup_date: string;
  file_name: string;
  file_size: number;
  status: 'SUCCESS' | 'FAILED';
  type: 'FULL' | 'DB_ONLY';
  created_at: string;
  drive_folder_id: string | null;
}

interface BackupLogsRow {
  id: string;
  backup_date: string;
  file_name: string;
  file_size: number;
  status: string;
  type: string;
  created_at: string;
  drive_folder_id: string | null;
  created_by?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  file_count?: number;
  backup_size?: number;
  retention_deleted?: number;
}

export class BackupRetentionService {
  private supabase: SupabaseClient;
  private drive: drive_v3.Drive | null = null;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  private getDriveClient(): drive_v3.Drive {
    if (!this.drive) {
      const keyPath = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH;
      if (!keyPath) {
        throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH environment variable is not set');
      }
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(
          fs.readFileSync(keyPath, 'utf8')
        ),
        scopes: ['https://www.googleapis.com/auth/drive']
      });
      this.drive = google.drive({ version: 'v3', auth });
    }
    return this.drive;
  }

  private getRootFolderId(): string {
    return process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  }

  async initializeBackupLogsTable(): Promise<void> {
    console.log('[BackupRetention] Backup logs table should exist - skipping initialization');
  }

  async logBackupEntry(entry: Omit<BackupLogEntry, 'id' | 'created_at'>): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('backup_logs')
        .insert({
          backup_date: entry.backup_date,
          file_name: entry.file_name,
          file_size: entry.file_size,
          status: entry.status,
          type: entry.type,
          drive_folder_id: entry.drive_folder_id,
          created_by: 'system'
        } as any)
        .select('id')
        .single();

      if (error) {
        console.error('[BackupRetention] Error logging backup:', error);
        return null;
      }

      return data?.id || null;
    } catch (err) {
      console.error('[BackupRetention] Error logging backup:', err);
      return null;
    }
  }

  async getBackupLogs(limit: number = 10): Promise<BackupLogEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('backup_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[BackupRetention] Error fetching backup logs:', error);
        return [];
      }

      return (data || []) as BackupLogEntry[];
    } catch (err) {
      console.error('[BackupRetention] Error fetching backup logs:', err);
      return [];
    }
  }

  async getCompletedBackups(limit: number = BACKUP_RETENTION_COUNT): Promise<BackupLogsRow[]> {
    try {
      const { data, error } = await this.supabase
        .from('backup_logs')
        .select('*')
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[BackupRetention] Error fetching completed backups:', error);
        return [];
      }

      return (data || []) as BackupLogsRow[];
    } catch (err) {
      console.error('[BackupRetention] Error fetching completed backups:', err);
      return [];
    }
  }

  async listDriveBackups(): Promise<DriveBackupFolder[]> {
    const rootFolderId = this.getRootFolderId();
    
    if (!rootFolderId) {
      console.log('[BackupRetention] No root folder ID configured');
      return [];
    }

    try {
      const response = await this.getDriveClient().files.list({
        q: `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc'
      });

      return (response.data.files || []).map((file) => ({
        id: file.id!,
        name: file.name!,
        createdTime: file.createdTime!
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      if (errorMsg.includes('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH')) {
        console.log('[BackupRetention] Google Drive not configured. Skipping Drive backup listing.');
      } else {
        console.error('[BackupRetention] Error listing drive backups:', err);
      }
      return [];
    }
  }

  async listFilesInFolder(folderId: string): Promise<DriveBackupFile[]> {
    try {
      const response = await this.getDriveClient().files.list({
        q: `'${folderId}' in parents`,
        fields: 'files(id, name, size, createdTime, mimeType)',
        orderBy: 'createdTime desc'
      });

      return (response.data.files || []).map((file) => ({
        id: file.id!,
        name: file.name!,
        size: parseInt(file.size || '0', 10),
        createdTime: file.createdTime!,
        mimeType: file.mimeType!
      }));
    } catch (err) {
      console.error('[BackupRetention] Error listing files in folder:', err);
      return [];
    }
  }

  async deleteDriveFile(fileId: string): Promise<boolean> {
    try {
      await this.getDriveClient().files.delete({ fileId });
      return true;
    } catch (err) {
      console.error('[BackupRetention] Error deleting drive file:', err);
      return false;
    }
  }

  async deleteDriveFolder(folderId: string): Promise<boolean> {
    try {
      const files = await this.listFilesInFolder(folderId);
      
      for (const file of files) {
        await this.deleteDriveFile(file.id);
      }
      
      await this.getDriveClient().files.delete({ fileId: folderId });
      return true;
    } catch (err) {
      console.error('[BackupRetention] Error deleting drive folder:', err);
      return false;
    }
  }

  async enforceFIFORetention(): Promise<RetentionCleanupResult> {
    const result: RetentionCleanupResult = {
      success: false,
      keptBackups: 0,
      deletedBackups: 0,
      deletedFiles: [],
      errors: [],
      timestamp: new Date().toISOString()
    };

    console.log('[BackupRetention] Starting FIFO retention enforcement...');
    console.log(`[BackupRetention] Retention policy: Keep latest ${BACKUP_RETENTION_COUNT} backups`);

    try {
      const folders = await this.listDriveBackups();
      
      if (folders.length === 0) {
        console.log('[BackupRetention] No backups found in Drive');
        result.success = true;
        result.keptBackups = 0;
        return result;
      }

      console.log(`[BackupRetention] Found ${folders.length} backup folders in Drive`);

      if (folders.length <= BACKUP_RETENTION_COUNT) {
        console.log(`[BackupRetention] Total backups (${folders.length}) <= retention count (${BACKUP_RETENTION_COUNT}). No cleanup needed.`);
        result.success = true;
        result.keptBackups = folders.length;
        return result;
      }

      const foldersToDelete = folders.slice(BACKUP_RETENTION_COUNT);
      const keptFolders = folders.slice(0, BACKUP_RETENTION_COUNT);

      console.log(`[BackupRetention] Keeping ${keptFolders.length} most recent backups`);
      console.log(`[BackupRetention] Deleting ${foldersToDelete.length} oldest backups`);

      for (const folder of foldersToDelete) {
        console.log(`[BackupRetention] Deleting backup folder: ${folder.name} (${folder.id})`);
        
        const files = await this.listFilesInFolder(folder.id);
        
        for (const file of files) {
          const deleted = await this.deleteDriveFile(file.id);
          if (deleted) {
            result.deletedFiles.push(file);
            result.deletedBackups++;
          }
        }

        const folderDeleted = await this.deleteDriveFolder(folder.id);
        if (folderDeleted) {
          console.log(`[BackupRetention] ✓ Deleted folder: ${folder.name}`);
        } else {
          result.errors.push(`Failed to delete folder: ${folder.name}`);
        }
      }

      result.success = result.errors.length === 0;
      result.keptBackups = keptFolders.length;

      console.log(`[BackupRetention] FIFO cleanup complete: kept ${result.keptBackups}, deleted ${result.deletedBackups}`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[BackupRetention] Error during FIFO cleanup:', errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }

    return result;
  }

  async cleanupOrphanedFiles(): Promise<{ deleted: number; errors: string[] }> {
    const result = { deleted: 0, errors: [] as string[] };
    
    console.log('[BackupRetention] Checking for orphaned files...');

    try {
      const folders = await this.listDriveBackups();
      
      for (const folder of folders) {
        const files = await this.listFilesInFolder(folder.id);
        
        for (const file of files) {
          if (!file.name.endsWith('.zip') && !file.name.endsWith('.json') && !file.name.endsWith('.md')) {
            console.log(`[BackupRetention] Deleting orphaned file: ${file.name}`);
            const deleted = await this.deleteDriveFile(file.id);
            if (deleted) result.deleted++;
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(errorMsg);
    }

    return result;
  }

  async getRetentionStatus(): Promise<{
    totalBackups: number;
    retentionCount: number;
    backupsToKeep: number;
    backupsToDelete: number;
    oldestBackup: string | null;
    newestBackup: string | null;
    isCompliant: boolean;
  }> {
    const folders = await this.listDriveBackups();
    const totalBackups = folders.length;
    const backupsToDelete = Math.max(0, totalBackups - BACKUP_RETENTION_COUNT);
    
    return {
      totalBackups,
      retentionCount: BACKUP_RETENTION_COUNT,
      backupsToKeep: Math.min(totalBackups, BACKUP_RETENTION_COUNT),
      backupsToDelete,
      oldestBackup: folders.length > 0 ? folders[folders.length - 1].createdTime : null,
      newestBackup: folders.length > 0 ? folders[0].createdTime : null,
      isCompliant: totalBackups <= BACKUP_RETENTION_COUNT
    };
  }

  async getTotalBackupSize(): Promise<{ totalSize: number; fileCount: number }> {
    let totalSize = 0;
    let fileCount = 0;

    const folders = await this.listDriveBackups();
    
    for (const folder of folders) {
      const files = await this.listFilesInFolder(folder.id);
      for (const file of files) {
        totalSize += file.size;
        fileCount++;
      }
    }

    return { totalSize, fileCount };
  }
}

export const backupRetentionService = new BackupRetentionService();
