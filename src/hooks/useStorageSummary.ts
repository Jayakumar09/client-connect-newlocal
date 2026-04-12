import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_BACKUP_API_URL || 'http://localhost:3001';
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || '';
const LOG_PREFIX = '[useStorageSummary]';

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

export interface SystemHealth {
  supabaseConnected: boolean;
  googleDriveConnected: boolean;
  lastHealthCheck: string;
  errors: string[];
  responseTimeMs?: number;
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

export interface AdminDashboard {
  storage: StorageSummary;
  backup: BackupSummary;
}

export type StorageStatusLevel = 'healthy' | 'moderate' | 'warning' | 'critical' | 'limit_reached';
export type BackupStatusLevel = 'idle' | 'running' | 'success' | 'failed';
export type CompletenessStatus = 'db_only' | 'partially_restorable' | 'fully_restorable';

export interface WarningState {
  hasWarning: boolean;
  isStorageLow: boolean;
  isBackupFailed: boolean;
  isStorageFull: boolean;
  isBackupStale: boolean;
  isIncomplete: boolean;
  message: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatBytesUtil(bytes: number): string {
  return formatBytes(bytes);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy': return 'text-green-600';
    case 'moderate': return 'text-blue-600';
    case 'warning': return 'text-orange-600';
    case 'critical': return 'text-red-600';
    case 'limit_reached': return 'text-red-800';
    case 'idle': return 'text-gray-500';
    case 'running': return 'text-blue-500';
    case 'success': return 'text-green-500';
    case 'failed': return 'text-red-500';
    default: return 'text-gray-600';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'healthy': return 'Healthy';
    case 'moderate': return 'Moderate Usage';
    case 'warning': return 'Approaching Limit';
    case 'critical': return 'Critical';
    case 'limit_reached': return 'Limit Reached';
    case 'idle': return 'Idle';
    case 'running': return 'Running';
    case 'success': return 'Success';
    case 'failed': return 'Failed';
    default: return 'Unknown';
  }
}

export function getWarningMessage(warningLevel: string): string | null {
  switch (warningLevel) {
    case '70': return 'Storage at 70%. Consider cleanup.';
    case '85': return 'Storage at 85%. Cleanup recommended.';
    case '95': return 'Storage at 95%! Immediate action required.';
    case '100': return 'Storage limit reached! Cannot upload.';
    default: return null;
  }
}

export function calculateStorageStatus(percent: number): StorageStatusLevel {
  if (percent >= 100) return 'limit_reached';
  if (percent >= 95) return 'critical';
  if (percent >= 85) return 'warning';
  if (percent >= 70) return 'moderate';
  return 'healthy';
}

export function getWarningState(storage: StorageSummary | null, backup: BackupSummary | null): WarningState {
  const result: WarningState = {
    hasWarning: false,
    isStorageLow: false,
    isBackupFailed: false,
    isStorageFull: false,
    isBackupStale: false,
    message: null
  };

  if (!storage && !backup) {
    return result;
  }

  if (storage) {
    if (storage.status === 'limit_reached') {
      result.hasWarning = true;
      result.isStorageFull = true;
      result.message = 'Storage limit reached! Upgrade required.';
      return result;
    }
    if (storage.status === 'critical') {
      result.hasWarning = true;
      result.isStorageLow = true;
      result.message = 'Storage at critical level (95%+)! Immediate action required.';
      return result;
    }
    if (storage.status === 'warning') {
      result.hasWarning = true;
      result.isStorageLow = true;
      result.message = 'Storage usage is high (85%+). Consider cleanup.';
      return result;
    }
  }

  if (backup) {
    if (backup.lastBackupStatus === 'failed') {
      result.hasWarning = true;
      result.isBackupFailed = true;
      result.message = 'Last backup failed! Please check system.';
      return result;
    }
    if (backup.lastBackupAt) {
      const daysSince = (Date.now() - new Date(backup.lastBackupAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 2) {
        result.hasWarning = true;
        result.isBackupStale = true;
        result.message = `Last backup was ${Math.floor(daysSince)} days ago.`;
        return result;
      }
    }
  }

  return result;
}

export function useStorageSummary() {
  const [storage, setStorage] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStorage = useCallback(async () => {
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] fetchStorage - Fetching storage summary`);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/storage/summary`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
      });
      if (!response.ok) throw new Error(`Failed to fetch storage summary: ${response.status}`);
      const data = await response.json();
      console.log(`${LOG_PREFIX} fetchStorage - Success:`, data);
      setStorage(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`${LOG_PREFIX} fetchStorage - Error:`, message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage]);

  return { storage, loading, error, refetch: fetchStorage };
}

export function useBackupSummary() {
  const [backup, setBackup] = useState<BackupSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBackup = useCallback(async () => {
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] fetchBackupSummary - Fetching backup summary`);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/backups/summary`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
      });
      if (!response.ok) throw new Error(`Failed to fetch backup summary: ${response.status}`);
      const data = await response.json();
      console.log(`${LOG_PREFIX} fetchBackupSummary - Success:`, data);
      setBackup(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`${LOG_PREFIX} fetchBackupSummary - Error:`, message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackup();
  }, [fetchBackup]);

  return { backup, loading, error, refetch: fetchBackup };
}

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] fetchHealth - Fetching system health`);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/health`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
      });
      if (!response.ok) throw new Error('Failed to fetch health');
      const result = await response.json();
      console.log(`${LOG_PREFIX} fetchHealth - Success:`, result);
      setHealth(result.data || result);
    } catch (err) {
      console.error(`${LOG_PREFIX} fetchHealth - Error:`, err);
      setHealth({
        supabaseConnected: false,
        googleDriveConnected: false,
        lastHealthCheck: new Date().toISOString(),
        errors: [err instanceof Error ? err.message : 'Unknown error']
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return { health, loading, refetch: fetchHealth };
}

export function useAdminDashboard() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] fetchDashboard - Fetching admin dashboard`);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/dashboard`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
      });
      if (!response.ok) throw new Error(`Failed to fetch dashboard: ${response.status}`);
      const result = await response.json();
      console.log(`${LOG_PREFIX} fetchDashboard - Success:`, result);
      setDashboard(result.data || result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`${LOG_PREFIX} fetchDashboard - Error:`, message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { dashboard, loading, error, refetch: fetchDashboard };
}

export function useProfileStorage(personId: string) {
  const [profileStorage, setProfileStorage] = useState<ProfileStorage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileStorage = useCallback(async () => {
    if (!personId) return;
    console.log(`${LOG_PREFIX} [${new Date().toISOString()}] fetchProfileStorage - Fetching profile ${personId} storage`);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/storage/profile/${personId}`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
      });
      if (!response.ok) throw new Error(`Failed to fetch profile storage: ${response.status}`);
      const data = await response.json();
      console.log(`${LOG_PREFIX} fetchProfileStorage - Success:`, data);
      setProfileStorage(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`${LOG_PREFIX} fetchProfileStorage - Error:`, message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    fetchProfileStorage();
  }, [fetchProfileStorage]);

  return { profileStorage, loading, error, refetch: fetchProfileStorage };
}

export const fetchStorageSummary = async (): Promise<StorageSummary | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/admin/storage/summary`, {
      headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
    });
    if (!response.ok) throw new Error(`Failed to fetch storage summary: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`${LOG_PREFIX} fetchStorageSummary - Error:`, error);
    return null;
  }
};

export const fetchProfileStorageUsage = async (personId: string): Promise<ProfileStorage | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/admin/storage/profile/${personId}`, {
      headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
    });
    if (!response.ok) throw new Error(`Failed to fetch profile storage: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`${LOG_PREFIX} fetchProfileStorageUsage - Error:`, error);
    return null;
  }
};

export const fetchBackupSummary = async (): Promise<BackupSummary | null> => {
  try {
    const response = await fetch(`${API_BASE}/api/admin/backups/summary`, {
      headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
    });
    if (!response.ok) throw new Error(`Failed to fetch backup summary: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`${LOG_PREFIX} fetchBackupSummary - Error:`, error);
    return null;
  }
};

export const fetchBackupHistory = async (limit = 50) => {
  try {
    const response = await fetch(`${API_BASE}/api/admin/backups/history?limit=${limit}`, {
      headers: { 'X-Admin-API-Key': ADMIN_API_KEY }
    });
    if (!response.ok) throw new Error(`Failed to fetch backup history: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`${LOG_PREFIX} fetchBackupHistory - Error:`, error);
    return null;
  }
};

export const triggerManualBackup = async (force = false) => {
  try {
    const response = await fetch(`${API_BASE}/api/backup/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': ADMIN_API_KEY
      },
      body: JSON.stringify({ force })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to trigger backup');
    }
    return await response.json();
  } catch (error) {
    console.error(`${LOG_PREFIX} triggerManualBackup - Error:`, error);
    throw error;
  }
};

export const cleanupOldBackups = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/admin/backups/cleanup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': ADMIN_API_KEY
      }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to run cleanup');
    }
    return await response.json();
  } catch (error) {
    console.error(`${LOG_PREFIX} cleanupOldBackups - Error:`, error);
    throw error;
  }
};

export const refreshAdminMetrics = async (): Promise<{ storage: StorageSummary | null; backup: BackupSummary | null }> => {
  console.log(`${LOG_PREFIX} [${new Date().toISOString()}] refreshAdminMetrics - Refreshing all metrics`);
  const [storage, backup] = await Promise.all([
    fetchStorageSummary(),
    fetchBackupSummary()
  ]);
  console.log(`${LOG_PREFIX} refreshAdminMetrics - Complete`);
  return { storage, backup };
};
