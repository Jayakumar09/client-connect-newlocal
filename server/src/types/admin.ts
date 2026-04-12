export interface StorageSummary {
  usedBytes: number;
  remainingBytes: number;
  totalBytes: number;
  usagePercent: number;
  status: 'healthy' | 'moderate' | 'warning' | 'critical' | 'limit_reached';
  warningLevel: 'none' | '70' | '85' | '95' | '100';
  profileAssetCount: number;
  profileAssetBytes: number;
  dbRecordCount: number;
  lastUpdated: string;
}

export interface ProfileStorage {
  profileId: string;
  profileName: string;
  imageCount: number;
  galleryCount: number;
  totalAttachments: number;
  totalBytes: number;
  lastUpdated: string;
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

export interface AdminDashboardSummary {
  storage: StorageSummary;
  backup: BackupSummary;
  systemHealth: {
    supabaseConnected: boolean;
    googleDriveConnected: boolean;
    lastHealthCheck: string;
    errors: string[];
  };
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
}

export interface BackupActionResponse {
  success: boolean;
  data?: {
    backupLogId?: string;
    backupType?: string;
    backupDate?: string;
    force?: boolean;
    status?: string;
    deletedCount?: number;
    retentionDays?: number;
    rootFolderId?: string;
  };
  message?: string;
  error?: string;
  code?: string;
  timestamp: string;
}

export interface HistoryResponse {
  success: boolean;
  data: BackupHistoryEntry[];
  count: number;
  timestamp: string;
}

export type BackupStatusLevel = 'idle' | 'running' | 'success' | 'failed';
export type StorageStatusLevel = 'healthy' | 'moderate' | 'warning' | 'critical' | 'limit_reached';
export type CompletenessStatus = 'db_only' | 'partially_restorable' | 'fully_restorable';

export interface WarningState {
  hasWarning: boolean;
  isStorageLow: boolean;
  isBackupFailed: boolean;
  isStorageFull: boolean;
  isBackupStale: boolean;
  message: string | null;
}
