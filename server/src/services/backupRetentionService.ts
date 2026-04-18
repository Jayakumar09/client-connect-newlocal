import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { google, drive_v3 } from 'googleapis';
import fs from 'fs';

const BACKUP_RETENTION_COUNT = parseInt(process.env.BACKUP_RETENTION_COUNT || '7');
const BACKUP_FOLDER_NAME = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'Vijayalakshmi_Matrimony_Backups';

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
  dryRun: boolean;
}

export interface BackupLogEntry {
  id: string;
  backup_date: string;
  file_name: string;
  file_size: number;
  status: 'SUCCESS' | 'FAILED';
  type: 'FULL' | 'DB_ONLY';
  created_at: string;
  completed_at?: string;
  drive_folder_id: string | null;
  drive_folder_name?: string;
  retention_deleted?: number;
  error_message?: string;
  created_by?: string;
}

interface BackupLogsRow {
  id: string;
  backup_date: string;
  file_name: string;
  file_size: number;
  status: 'SUCCESS' | 'FAILED' | 'completed' | 'failed' | 'in_progress' | 'deleted_by_retention';
  type: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  drive_folder_id: string | null;
  drive_folder_name?: string;
  created_by?: string;
  error_message?: string;
  retention_deleted?: number;
  file_count?: number;
  backup_size?: number;
}

type BackupLogInsertPayload = {
  backup_date: string;
  file_name: string;
  file_size: number;
  status: BackupLogEntry['status'];
  type: BackupLogEntry['type'];
  drive_folder_id: string | null;
  drive_folder_name?: string;
  created_by: string;
  completed_at: string | null;
  error_message: string | null;
};

type BackupLogUpdatePayload = Partial<BackupLogsRow> & {
  status?: BackupLogsRow['status'] | 'deleted_by_retention';
};

export class BackupRetentionService {
  private supabase: SupabaseClient | null = null;
  private drive: drive_v3.Drive | null = null;
  private rootFolderId: string | null = null;

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) {
        throw new Error('Supabase environment variables not configured');
      }
      this.supabase = createClient(url, key);
    }
    return this.supabase;
  }

  private getDriveClient(): drive_v3.Drive {
    if (!this.drive) {
      const keyPath = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH;
      if (!keyPath) {
        throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH environment variable is not set');
      }
      const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive']
      });
      this.drive = google.drive({ version: 'v3', auth });
    }
    return this.drive;
  }

  async initializeRootFolderId(): Promise<string | null> {
    if (this.rootFolderId) return this.rootFolderId;
    
    const configuredId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (configuredId) {
      this.rootFolderId = configuredId;
      return this.rootFolderId;
    }

    try {
      const folders = await this.listDriveBackups();
      if (folders.length > 0) {
        this.rootFolderId = folders[0].id;
        return this.rootFolderId;
      }
    } catch (err) {
      console.log('[BackupRetention] Could not determine root folder ID');
    }
    
    return null;
  }

  async logBackupEntry(entry: Omit<BackupLogEntry, 'id' | 'created_at'>): Promise<string | null> {
    try {
      const payload: BackupLogInsertPayload = {
        backup_date: entry.backup_date,
        file_name: entry.file_name,
        file_size: entry.file_size,
        status: entry.status,
        type: entry.type,
        drive_folder_id: entry.drive_folder_id,
        drive_folder_name: entry.drive_folder_name,
        created_by: entry.created_by || 'system',
        completed_at: entry.completed_at || null,
        error_message: entry.error_message || null
      };

      const { data, error } = await this.getSupabase()
        .from('backup_logs')
        .insert(payload as never)
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

  async updateBackupLog(id: string, updates: Partial<BackupLogsRow>): Promise<boolean> {
    try {
      const { error } = await this.getSupabase()
        .from('backup_logs')
        .update(updates as BackupLogUpdatePayload as never)
        .eq('id', id);

      if (error) {
        console.error('[BackupRetention] Error updating backup log:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[BackupRetention] Error updating backup log:', err);
      return false;
    }
  }

  async getSuccessfulBackups(limit?: number): Promise<BackupLogsRow[]> {
    try {
      let query = this.getSupabase()
        .from('backup_logs')
        .select('*')
        .in('status', ['SUCCESS', 'completed'])
        .order('completed_at', { ascending: false });
      
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[BackupRetention] Error fetching successful backups:', error);
        return [];
      }

      return (data || []) as BackupLogsRow[];
    } catch (err) {
      console.error('[BackupRetention] Error fetching successful backups:', err);
      return [];
    }
  }

  async getAllBackups(): Promise<BackupLogsRow[]> {
    try {
      const { data, error } = await this.getSupabase()
        .from('backup_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[BackupRetention] Error fetching all backups:', error);
        return [];
      }

      return (data || []) as BackupLogsRow[];
    } catch (err) {
      console.error('[BackupRetention] Error fetching all backups:', err);
      return [];
    }
  }

  async getBackupById(id: string): Promise<BackupLogsRow | null> {
    try {
      const { data, error } = await this.getSupabase()
        .from('backup_logs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('[BackupRetention] Error fetching backup by id:', error);
        return null;
      }

      return data as BackupLogsRow;
    } catch (err) {
      console.error('[BackupRetention] Error fetching backup by id:', err);
      return null;
    }
  }

  async listDriveBackups(): Promise<DriveBackupFolder[]> {
    const rootFolderId = await this.initializeRootFolderId();
    
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
      console.error('[BackupRetention] Error listing drive backups:', err);
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

  async deleteEntireBackupSet(folderId: string, folderName: string): Promise<{ success: boolean; deletedFiles: number; errors: string[] }> {
    const result = { success: true, deletedFiles: 0, errors: [] as string[] };
    
    console.log(`[BackupRetention] Deleting backup set: ${folderName} (${folderId})`);

    try {
      const files = await this.listFilesInFolder(folderId);
      
      for (const file of files) {
        const deleted = await this.deleteDriveFile(file.id);
        if (deleted) {
          result.deletedFiles++;
          console.log(`[BackupRetention]   Deleted: ${file.name}`);
        } else {
          result.errors.push(`Failed to delete: ${file.name}`);
        }
      }

      const folderDeleted = await this.deleteDriveFile(folderId);
      if (folderDeleted) {
        console.log(`[BackupRetention]   Deleted folder: ${folderName}`);
      } else {
        result.errors.push(`Failed to delete folder: ${folderName}`);
        result.success = false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(errorMsg);
      result.success = false;
    }

    return result;
  }

  async enforceFIFORetention(options: { dryRun?: boolean } = {}): Promise<RetentionCleanupResult> {
    const result: RetentionCleanupResult = {
      success: false,
      keptBackups: 0,
      deletedBackups: 0,
      deletedFiles: [],
      errors: [],
      timestamp: new Date().toISOString(),
      dryRun: options.dryRun || false
    };

    console.log('[BackupRetention] Starting FIFO retention enforcement...');
    console.log(`[BackupRetention] Policy: Keep latest ${BACKUP_RETENTION_COUNT} successful backups`);
    console.log(`[BackupRetention] Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);

    try {
      const successfulBackups = await this.getSuccessfulBackups();
      
      if (successfulBackups.length === 0) {
        console.log('[BackupRetention] No successful backups found in metadata table');
        result.success = true;
        result.keptBackups = 0;
        return result;
      }

      console.log(`[BackupRetention] Found ${successfulBackups.length} successful backups in metadata`);

      const backupsWithDriveFolder = successfulBackups.filter(b => b.drive_folder_id);
      const backupsWithoutDriveFolder = successfulBackups.filter(b => !b.drive_folder_id);

      const sortedByTime = backupsWithDriveFolder.sort((a, b) => {
        const timeA = a.completed_at || a.created_at;
        const timeB = b.completed_at || b.created_at;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      if (sortedByTime.length <= BACKUP_RETENTION_COUNT) {
        console.log(`[BackupRetention] Total successful backups (${sortedByTime.length}) <= retention count (${BACKUP_RETENTION_COUNT}). No cleanup needed.`);
        result.success = true;
        result.keptBackups = sortedByTime.length;
        return result;
      }

      const backupsToDelete = sortedByTime.slice(BACKUP_RETENTION_COUNT);
      const backupsToKeep = sortedByTime.slice(0, BACKUP_RETENTION_COUNT);

      console.log(`[BackupRetention] Keeping ${backupsToKeep.length} most recent backups:`);
      for (const backup of backupsToKeep) {
        const time = backup.completed_at || backup.created_at;
        console.log(`[BackupRetention]   ✓ ${backup.backup_date} (${backup.drive_folder_name || backup.drive_folder_id}) - ${time}`);
      }

      console.log(`\n[BackupRetention] Deleting ${backupsToDelete.length} oldest backups:`);
      for (const backup of backupsToDelete) {
        const time = backup.completed_at || backup.created_at;
        console.log(`[BackupRetention]   ✗ ${backup.backup_date} (${backup.drive_folder_name || backup.drive_folder_id}) - ${time}`);
      }

      if (options.dryRun) {
        console.log('\n[BackupRetention] DRY RUN - No actual deletions performed');
        result.keptBackups = backupsToKeep.length;
        result.deletedBackups = backupsToDelete.length;
        result.success = true;
        return result;
      }

      for (const backup of backupsToDelete) {
        if (!backup.drive_folder_id) {
          console.log(`[BackupRetention] Skipping backup without Drive folder: ${backup.backup_date}`);
          continue;
        }

        const deleteResult = await this.deleteEntireBackupSet(backup.drive_folder_id, backup.drive_folder_name || backup.drive_folder_id);
        
        if (deleteResult.success) {
          result.deletedBackups++;
          result.deletedFiles.push(...(await this.listFilesInFolder(backup.drive_folder_id)));
          
          await this.updateBackupLog(backup.id, {
            status: 'deleted_by_retention',
            retention_deleted: 1
          });
        } else {
          result.errors.push(...deleteResult.errors);
        }
      }

      result.success = result.errors.length === 0;
      result.keptBackups = backupsToKeep.length;

      console.log(`\n[BackupRetention] FIFO cleanup complete:`);
      console.log(`[BackupRetention]   Kept: ${result.keptBackups}`);
      console.log(`[BackupRetention]   Deleted: ${result.deletedBackups}`);
      console.log(`[BackupRetention]   Files deleted: ${result.deletedFiles.length}`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[BackupRetention] Error during FIFO cleanup:', errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }

    return result;
  }

  async getRetentionStatus(): Promise<{
    totalSuccessfulBackups: number;
    totalBackupsInDrive: number;
    retentionCount: number;
    backupsToKeep: number;
    backupsToDelete: number;
    oldestSuccessfulBackup: string | null;
    newestSuccessfulBackup: string | null;
    isCompliant: boolean;
    nextCleanupDue: string | null;
  }> {
    const successfulBackups = await this.getSuccessfulBackups();
    const driveBackups = await this.listDriveBackups();
    
    const sortedByTime = successfulBackups
      .filter(b => b.drive_folder_id)
      .sort((a, b) => {
        const timeA = a.completed_at || a.created_at;
        const timeB = b.completed_at || b.created_at;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

    const backupsToDelete = Math.max(0, sortedByTime.length - BACKUP_RETENTION_COUNT);
    
    return {
      totalSuccessfulBackups: successfulBackups.length,
      totalBackupsInDrive: driveBackups.length,
      retentionCount: BACKUP_RETENTION_COUNT,
      backupsToKeep: Math.min(sortedByTime.length, BACKUP_RETENTION_COUNT),
      backupsToDelete,
      oldestSuccessfulBackup: sortedByTime.length > 0 ? (sortedByTime[sortedByTime.length - 1].completed_at || sortedByTime[sortedByTime.length - 1].created_at) : null,
      newestSuccessfulBackup: sortedByTime.length > 0 ? (sortedByTime[0].completed_at || sortedByTime[0].created_at) : null,
      isCompliant: backupsToDelete === 0,
      nextCleanupDue: backupsToDelete > 0 ? 'Now - cleanup recommended' : null
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

  async cleanupOrphanedDriveFolders(): Promise<{ deleted: number; errors: string[] }> {
    const result = { deleted: 0, errors: [] as string[] };
    
    console.log('[BackupRetention] Checking for orphaned folders not in metadata...');

    try {
      const successfulBackups = await this.getSuccessfulBackups();
      const knownFolderIds = new Set(successfulBackups.filter(b => b.drive_folder_id).map(b => b.drive_folder_id));
      
      const driveFolders = await this.listDriveBackups();
      
      for (const folder of driveFolders) {
        if (!knownFolderIds.has(folder.id)) {
          console.log(`[BackupRetention] Found orphaned folder: ${folder.name} (${folder.id})`);
          
          if (!folder.name.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.log(`[BackupRetention] Deleting non-backup folder: ${folder.name}`);
            const deleteResult = await this.deleteEntireBackupSet(folder.id, folder.name);
            if (deleteResult.success) {
              result.deleted++;
            } else {
              result.errors.push(...deleteResult.errors);
            }
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(errorMsg);
    }

    return result;
  }
}

export const backupRetentionService = new BackupRetentionService();
