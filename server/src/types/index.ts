export interface BackupLog {
  id: string;
  type: 'manual' | 'automatic';
  status: 'in_progress' | 'completed' | 'failed';
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

export interface BackupStatus {
  isRunning: boolean;
  lastBackup: BackupLog | null;
  nextScheduledBackup: string | null;
  totalBackupSize: number;
  retentionDays: number;
  recentBackups: BackupLog[];
}

export interface BackupStatusResponse {
  isRunning: boolean;
  lastBackup: BackupLog | null;
  nextScheduledBackup: string;
  totalBackupSize: number;
  retentionDays: number;
  recentBackups: BackupLog[];
  lastBackupAt: string | null;
  lastBackupSize: number | null;
  lastBackupStatus: 'completed' | 'failed' | 'in_progress' | null;
}

export type CompletenessStatus = 'db_only' | 'partially_restorable' | 'fully_restorable';

export interface RestoredFile {
  path: string;
  original_name: string;
  size: number;
  actual_size: number;
  content_type: string;
  uploaded_at: string;
  downloaded: boolean;
  download_error?: string;
}

export interface BucketFile {
  bucket_name: string;
  path: string;
  original_name: string;
  size: number;
  actual_size: number;
  content_type: string;
  uploaded_at: string;
  downloaded: boolean;
  download_error?: string;
}

export interface BucketBackupResult {
  bucket_name: string;
  files_expected: number;
  files_included: number;
  files_missing: string[];
  total_expected_size: number;
  total_included_size: number;
  files: BucketFile[];
}

export interface BackupManifest {
  backup_version: string;
  backup_date: string;
  backup_type: 'manual' | 'automatic';
  created_by: string;
  completeness: CompletenessStatus;
  is_full_restorable: boolean;
  database: {
    export_time: string;
    tables: string[];
    record_counts: Record<string, number>;
    exported_bytes: number;
  };
  storage: {
    buckets: BucketBackupResult[];
    total_files_expected: number;
    total_files_included: number;
    total_files_missing: number;
    total_expected_size: number;
    total_included_size: number;
  };
  external_images: ExternalImage[];
  archive: {
    total_size: number;
    database_only_size: number;
    storage_included_size: number;
    file_count_in_archive: number;
  };
  validation: {
    is_valid: boolean;
    is_complete: boolean;
    missing_files_report: string[];
    warnings: string[];
    validated_at: string;
  };
}

export interface StorageFile {
  bucket_name: string;
  path: string;
  original_name: string;
  size: number;
  content_type: string;
  uploaded_at: string;
}

export interface ArchiveValidation {
  is_valid: boolean;
  is_complete: boolean;
  files_in_archive: string[];
  expected_files: string[];
  missing_files: string[];
  warnings: string[];
}

export interface ExternalImage {
  url: string;
  profile_id: string;
  field: string;
}

export interface BackupProgress {
  stage: 'initializing' | 'exporting_database' | 'collecting_files' | 'creating_archive' | 'uploading' | 'cleaning_up' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
  filesProcessed?: number;
  filesTotal?: number;
  bytesProcessed?: number;
}

export interface DriveFolder {
  id: string;
  name: string;
  created_at: string;
}

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
