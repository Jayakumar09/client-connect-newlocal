import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';
import { getApiEndpoint, getAppConfig } from '@/lib/config';

type BackupStatus = Tables<'backup_logs'>['status'];
type BackupType = Tables<'backup_logs'>['type'];

const LOG_PREFIX = '[BackupContext]';
const BACKUP_API_URL = getApiEndpoint('');
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || '';

export interface BackupLog {
  id: string;
  type: BackupType;
  status: BackupStatus;
  started_at: string;
  completed_at: string | null;
  file_count: number | null;
  backup_size: number | null;
  drive_folder_id: string | null;
  backup_date: string;
  retention_deleted: number | null;
  error_message: string | null;
  created_by: string;
}

export interface BackupProgress {
  stage: string;
  progress: number;
  message: string;
  error?: string;
}

export interface BackupState {
  status: 'idle' | 'running' | 'success' | 'failed';
  isRunning: boolean;
  lastBackup: BackupLog | null;
  lastBackupAt: string | null;
  lastBackupSize: number | null;
  lastBackupCompleteness: 'db_only' | 'partially_restorable' | 'fully_restorable' | 'unknown';
  nextScheduledBackup: string | null;
  totalBackupSize: number;
  retentionDays: number;
  retentionPolicyDays: number;
  retentionMaxCount: number;
  recentBackups: BackupLog[];
  currentProgress: BackupProgress | null;
  backupCount: number;
  backupTotalBytes: number;
}

export interface BackupSummary {
  backupCount: number;
  backupTotalBytes: number;
  lastBackupAt: string | null;
  lastBackupSize: number | null;
  lastBackupStatus: 'completed' | 'failed' | null;
  nextScheduledBackupAt: string;
  retentionPolicyDays: number;
  retentionMaxCount: number;
  oldestBackupAt: string | null;
  newestBackupAt: string | null;
}

export interface BackupHistoryResponse {
  success: boolean;
  data: BackupHistoryEntry[];
  count: number;
  timestamp: string;
}

export interface BackupHistoryEntry {
  id: string;
  type: 'manual' | 'automatic';
  status: 'completed' | 'failed' | 'in_progress';
  startedAt: string;
  completedAt: string | null;
  fileCount: number;
  backupSize: number;
  driveFolderId: string | null;
  backupDate: string;
  retentionDeleted: number;
  errorMessage: string | null;
  createdBy: string;
  completeness?: 'db_only' | 'partially_restorable' | 'fully_restorable' | 'unknown';
}

export interface BackupActionResponse {
  success: boolean;
  data?: {
    backupLogId?: string;
    backupType?: string;
    backupDate?: string;
    force?: boolean;
    status?: string;
  };
  message?: string;
  error?: string;
  code?: string;
  timestamp: string;
}

export interface CleanupResponse {
  success: boolean;
  data?: {
    deletedCount: number;
    retentionDays: number;
    rootFolderId: string;
  };
  message?: string;
  error?: string;
  code?: string;
  timestamp: string;
}

interface BackupContextType {
  state: BackupState;
  fetchBackupSummary: () => Promise<BackupSummary | null>;
  fetchBackupHistory: (limit?: number) => Promise<BackupHistoryEntry[]>;
  triggerManualBackup: (force?: boolean) => Promise<boolean>;
  cleanupOldBackups: () => Promise<CleanupResponse | null>;
  refreshBackupStatus: () => Promise<void>;
  refreshAdminMetrics: () => Promise<void>;
}

const initialState: BackupState = {
  status: 'idle',
  isRunning: false,
  lastBackup: null,
  lastBackupAt: null,
  lastBackupSize: null,
  lastBackupCompleteness: 'unknown',
  nextScheduledBackup: null,
  totalBackupSize: 0,
  retentionDays: 7,
  retentionPolicyDays: 7,
  retentionMaxCount: 7,
  recentBackups: [],
  currentProgress: null,
  backupCount: 0,
  backupTotalBytes: 0
};

const BackupContext = createContext<BackupContextType | null>(null);

function getNextScheduledBackup(): string {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(2, 0, 0, 0);
  return next.toISOString();
}

function determineStatus(lastBackup: BackupLog | null, isRunning: boolean): 'idle' | 'running' | 'success' | 'failed' {
  if (isRunning) return 'running';
  if (!lastBackup) return 'idle';
  if (lastBackup.status === 'completed') return 'success';
  if (lastBackup.status === 'failed') return 'failed';
  return 'idle';
}

export function BackupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BackupState>(initialState);
  const config = getAppConfig();

  const fetchBackupSummary = useCallback(async (): Promise<BackupSummary | null> => {
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] fetchBackupSummary - Fetching backup summary`);
    try {
      const response = await fetch(`${BACKUP_API_URL}/api/admin/backups/summary`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch backup summary: ${response.status}`);
      }

      const result = await response.json();
      const data: BackupSummary = result.data || result;
      console.log(`${LOG_PREFIX} fetchBackupSummary - Success: backupCount=${data.backupCount}, lastBackupAt=${data.lastBackupAt}, lastBackupSize=${data.lastBackupSize}`);

      setState(prev => ({
        ...prev,
        backupCount: data.backupCount,
        backupTotalBytes: data.backupTotalBytes,
        lastBackupAt: data.lastBackupAt,
        lastBackupSize: data.lastBackupSize,
        nextScheduledBackup: data.nextScheduledBackupAt,
        retentionPolicyDays: data.retentionPolicyDays,
        retentionMaxCount: data.retentionMaxCount
      }));

      return data;
    } catch (error) {
      console.error(`${LOG_PREFIX} fetchBackupSummary - Error:`, error);
      return null;
    }
  }, []);

  const fetchBackupHistory = useCallback(async (limit = 50): Promise<BackupHistoryEntry[]> => {
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] fetchBackupHistory - Fetching backup history (limit=${limit})`);
    try {
      const response = await fetch(`${BACKUP_API_URL}/api/admin/backups/history?limit=${limit}`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch backup history: ${response.status}`);
      }

      const data: BackupHistoryResponse = await response.json();
      console.log(`${LOG_PREFIX} fetchBackupHistory - Success: ${data.count} entries`);

      return data.data;
    } catch (error) {
      console.error(`${LOG_PREFIX} fetchBackupHistory - Error:`, error);
      return [];
    }
  }, []);

  const refreshBackupStatus = useCallback(async () => {
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] refreshBackupStatus - Refreshing backup status`);
    try {
      const response = await fetch(`${BACKUP_API_URL}/api/backup/status`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh backup status: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data || result;
      console.log(`${LOG_PREFIX} refreshBackupStatus - Success: isRunning=${data.isRunning}, lastBackupStatus=${data.lastBackupStatus}`);

      const lastBackup = data.lastBackup as BackupLog | null;
      const status = determineStatus(lastBackup, data.isRunning);

      let completeness: 'db_only' | 'partially_restorable' | 'fully_restorable' | 'unknown' = 'unknown';
      
      if (lastBackup?.error_message) {
        const match = lastBackup.error_message.match(/^\[(db_only|partially_restorable|fully_restorable)\]/);
        if (match) {
          completeness = match[1] as 'db_only' | 'partially_restorable' | 'fully_restorable';
        } else if (lastBackup.error_message.includes('Fully Restorable')) {
          completeness = 'fully_restorable';
        } else if (lastBackup.error_message.includes('Partially Restorable')) {
          completeness = 'partially_restorable';
        } else if (lastBackup.error_message.includes('DB Only')) {
          completeness = 'db_only';
        }
      }

      setState(prev => ({
        ...prev,
        status,
        isRunning: data.isRunning || false,
        lastBackup,
        lastBackupAt: data.lastBackupAt || data.lastBackup?.completed_at || null,
        lastBackupSize: data.lastBackupSize || data.lastBackup?.backup_size || null,
        lastBackupCompleteness: completeness,
        nextScheduledBackup: data.nextScheduledBackup || getNextScheduledBackup(),
        totalBackupSize: data.totalBackupSize || 0,
        retentionDays: data.retentionDays || 7,
        recentBackups: data.recentBackups || []
      }));
    } catch (error) {
      console.error(`${LOG_PREFIX} refreshBackupStatus - Error:`, error);
    }
  }, []);

  const triggerManualBackup = useCallback(async (force = false): Promise<boolean> => {
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] triggerManualBackup - Triggering manual backup (force=${force})`);

    if (state.status === 'running') {
      toast.error('A backup is already in progress');
      return false;
    }

    setState(prev => ({ ...prev, status: 'running', isRunning: true, currentProgress: null }));

    try {
      const response = await fetch(`${BACKUP_API_URL}/api/backup/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': ADMIN_API_KEY
        },
        body: JSON.stringify({ force })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 409 && !force) {
          toast.error(errorData.error, {
            description: 'A backup already exists for today. Use force=true to create a new one.'
          });
        } else {
          toast.error(errorData.error || 'Failed to trigger backup');
        }
        setState(prev => ({ ...prev, status: 'idle', isRunning: false }));
        return false;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let backupCompleted = false;
      let backupFailed = false;
      let finalErrorMessage = '';

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const progressData = line.slice(6).trim();
                  if (!progressData) continue;
                  
                  const progress: BackupProgress = JSON.parse(progressData);
                  console.log(`${LOG_PREFIX} Progress: stage=${progress.stage}, progress=${progress.progress}%, message=${progress.message}`);
                  
                  setState(prev => ({ ...prev, currentProgress: progress }));

                  if (progress.stage === 'completed') {
                    backupCompleted = true;
                    toast.success('Backup completed successfully!');
                    setState(prev => ({ ...prev, status: 'success' }));
                  } else if (progress.stage === 'failed') {
                    backupFailed = true;
                    finalErrorMessage = progress.error || progress.message;
                    toast.error('Backup failed', { description: finalErrorMessage });
                    setState(prev => ({ ...prev, status: 'failed', currentProgress: null }));
                  }
                } catch (e) {
                  console.error(`${LOG_PREFIX} Error parsing progress line:`, e);
                }
              }
            }
          }
        } catch (e) {
          console.error(`${LOG_PREFIX} SSE reading error:`, e);
        }
      }

      setState(prev => ({ ...prev, isRunning: false, currentProgress: null }));
      
      if (!backupCompleted && !backupFailed) {
        await refreshBackupStatus();
      } else {
        await refreshBackupStatus();
        await fetchBackupSummary();
      }
      
      return backupCompleted && !backupFailed;
    } catch (error) {
      console.error(`${LOG_PREFIX} triggerManualBackup - Error:`, error);
      toast.error('Failed to trigger backup');
      setState(prev => ({ ...prev, status: 'failed', isRunning: false, currentProgress: null }));
      return false;
    }
  }, [state.status, refreshBackupStatus, fetchBackupSummary]);

  const cleanupOldBackups = useCallback(async (): Promise<CleanupResponse | null> => {
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] cleanupOldBackups - Running cleanup`);
    try {
      const response = await fetch(`${BACKUP_API_URL}/api/admin/backups/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': ADMIN_API_KEY
        }
      });

      const data: CleanupResponse = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to run cleanup');
        return data;
      }

      toast.success(data.message || `Cleanup completed: ${data.data?.deletedCount || 0} old backups deleted`);
      await refreshBackupStatus();
      return data;
    } catch (error) {
      console.error(`${LOG_PREFIX} cleanupOldBackups - Error:`, error);
      toast.error('Failed to run cleanup');
      return null;
    }
  }, [refreshBackupStatus]);

  const refreshAdminMetrics = useCallback(async () => {
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] refreshAdminMetrics - Refreshing all metrics`);
    await Promise.all([
      refreshBackupStatus(),
      fetchBackupSummary()
    ]);
    console.log(`${LOG_PREFIX} refreshAdminMetrics - Complete`);
  }, [refreshBackupStatus, fetchBackupSummary]);

  useEffect(() => {
    console.log(`${LOG_PREFIX} Initializing backup context`);
    // Only fetch backup status for admin users in production
    // Skip for client-auth page and preview deployments to avoid 404s
    if (config.isAdmin && config.isProduction) {
      refreshAdminMetrics();
      const interval = setInterval(refreshBackupStatus, 60000);
      return () => {
        console.log(`${LOG_PREFIX} Cleaning up backup context`);
        clearInterval(interval);
      };
    }
    console.log(`${LOG_PREFIX} Skipping backup status fetch for client/preview mode`);
  }, [config.isAdmin, config.isProduction, refreshAdminMetrics, refreshBackupStatus]);

  return (
    <BackupContext.Provider
      value={{
        state,
        fetchBackupSummary,
        fetchBackupHistory,
        triggerManualBackup,
        cleanupOldBackups,
        refreshBackupStatus,
        refreshAdminMetrics
      }}
    >
      {children}
    </BackupContext.Provider>
  );
}

export function useBackup() {
  const context = useContext(BackupContext);
  if (!context) {
    throw new Error('useBackup must be used within a BackupProvider');
  }
  return context;
}
