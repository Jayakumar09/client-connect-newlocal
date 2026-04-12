import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBackup, BackupHistoryEntry } from '@/contexts/BackupContext';
import { useStorageSummary, getWarningState, formatBytesUtil, getStatusColor, getStatusLabel } from '@/hooks/useStorageSummary';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import {
  Cloud,
  CloudDownload,
  CheckCircle,
  XCircle,
  Clock,
  HardDrive,
  FileArchive,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Server,
  Database,
  ShieldCheck,
  Activity
} from 'lucide-react';

interface BackupDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function BackupDialog({ open, onClose }: BackupDialogProps) {
  const { state, fetchBackupHistory, triggerManualBackup, cleanupOldBackups, refreshAdminMetrics } = useBackup();
  const { storage, refetch: refetchStorage } = useStorageSummary();
  const [logs, setLogs] = useState<BackupHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedLogs = await fetchBackupHistory(20);
      setLogs(fetchedLogs);
    } catch (error) {
      toast.error('Failed to load backup logs');
    } finally {
      setLoading(false);
    }
  }, [fetchBackupHistory]);

  useEffect(() => {
    if (open) {
      loadLogs();
      refetchStorage();
    }
  }, [open, loadLogs, refetchStorage]);

  const handleManualBackup = async () => {
    try {
      await triggerManualBackup(false);
      toast.success('Backup started successfully');
      await loadLogs();
    } catch (error) {
      toast.error('Failed to start backup');
    }
  };

  const handleForceBackup = async () => {
    try {
      await triggerManualBackup(true);
      toast.success('Backup started (forced)');
      await loadLogs();
    } catch (error) {
      toast.error('Failed to start backup');
    }
  };

  const handleCleanup = async () => {
    try {
      await cleanupOldBackups();
      toast.success('Cleanup completed');
      await loadLogs();
      await refreshAdminMetrics();
    } catch (error) {
      toast.error('Failed to run cleanup');
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadLogs(), refreshAdminMetrics(), refetchStorage()]);
    toast.success('Data refreshed');
  };

  const formatBytes = (bytes: number | null | undefined): string => {
    if (!bytes) return '0 B';
    return formatBytesUtil(bytes);
  };

  const getBackupStatus = (): 'idle' | 'running' | 'success' | 'failed' => {
    return state.status;
  };

  const getOverallStatus = (): 'healthy' | 'moderate' | 'warning' | 'critical' | 'limit_reached' => {
    if (state.status === 'failed' || state.lastBackup?.status === 'failed') return 'critical';
    if (!state.lastBackup) return 'moderate';
    if (state.lastBackup.status === 'completed') {
      if (state.lastBackup.completed_at) {
        const daysSince = (Date.now() - new Date(state.lastBackup.completed_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 2) return 'warning';
      }
      return 'healthy';
    }
    if (state.status === 'running') return 'moderate';
    return 'moderate';
  };

  const warningState = getWarningState(storage, {
    backupCount: state.backupCount,
    backupTotalBytes: state.backupTotalBytes,
    lastBackupAt: state.lastBackupAt,
    lastBackupSize: state.lastBackupSize,
    lastBackupStatus: state.lastBackup?.status || null,
    nextScheduledBackupAt: state.nextScheduledBackup || '',
    retentionPolicyDays: state.retentionPolicyDays,
    retentionMaxCount: state.retentionMaxCount,
    oldestBackupAt: null,
    newestBackupAt: null
  });

  const getStatusBanner = () => {
    const status = getOverallStatus();
    const backupStatus = getBackupStatus();

    if (warningState.hasWarning) {
      if (warningState.isStorageFull) {
        return (
          <Alert className="border-red-800 bg-red-100" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Storage Limit Reached:</strong> {warningState.message} Upgrade required to continue.
            </AlertDescription>
          </Alert>
        );
      }
      if (warningState.isBackupFailed) {
        return (
          <Alert className="border-red-500 bg-red-50" variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Backup Failed:</strong> {warningState.message} Check system and run a manual backup.
            </AlertDescription>
          </Alert>
        );
      }
      if (warningState.isStorageLow) {
        return (
          <Alert className="border-orange-500 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Storage Warning:</strong> {warningState.message}
            </AlertDescription>
          </Alert>
        );
      }
      if (warningState.isBackupStale) {
        return (
          <Alert className="border-yellow-500 bg-yellow-50">
            <Clock className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Backup Stale:</strong> {warningState.message} Consider running a manual backup.
            </AlertDescription>
          </Alert>
        );
      }
    }

    switch (status) {
      case 'healthy':
        return (
          <Alert className="border-green-500 bg-green-50">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Healthy:</strong> Backup system is operational. Last backup completed successfully.
            </AlertDescription>
          </Alert>
        );
      case 'moderate':
        return (
          <Alert className="border-blue-500 bg-blue-50">
            <Server className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Ready:</strong> {backupStatus === 'running' ? 'Backup in progress...' : 'No recent issues detected.'}
            </AlertDescription>
          </Alert>
        );
      case 'warning':
        return (
          <Alert className="border-orange-500 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Approaching Limit:</strong> {warningState.message || 'Last backup was over 2 days ago. Consider running a manual backup.'}
            </AlertDescription>
          </Alert>
        );
      case 'critical':
        return (
          <Alert className="border-red-500 bg-red-50" variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Critical:</strong> Last backup failed. Please check system and run a manual backup.
            </AlertDescription>
          </Alert>
        );
      case 'limit_reached':
        return (
          <Alert className="border-red-800 bg-red-100" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Limit Reached:</strong> Storage limit reached! Upgrade required to continue.
            </AlertDescription>
          </Alert>
        );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      initializing: 'Initializing...',
      exporting_database: 'Exporting Database',
      collecting_files: 'Collecting Files',
      creating_archive: 'Creating Archive',
      uploading: 'Uploading to Drive',
      cleaning_up: 'Cleaning Up',
      completed: 'Completed',
      failed: 'Failed'
    };
    return labels[stage] || stage;
  };

  const getCompletenessLabel = (completeness?: string): { label: string; color: string; icon: React.ReactNode } => {
    switch (completeness) {
      case 'fully_restorable':
        return { label: 'Fully Restorable', color: 'text-green-600', icon: <CheckCircle className="w-4 h-4 text-green-500" /> };
      case 'partially_restorable':
        return { label: 'Partially Restorable', color: 'text-orange-600', icon: <AlertTriangle className="w-4 h-4 text-orange-500" /> };
      case 'db_only':
        return { label: 'DB Only', color: 'text-yellow-600', icon: <Database className="w-4 h-4 text-yellow-500" /> };
      default:
        return { label: 'Unknown', color: 'text-gray-500', icon: <Clock className="w-4 h-4 text-gray-400" /> };
    }
  };

  const parseCompletenessFromError = (errorMessage?: string | null): 'db_only' | 'partially_restorable' | 'fully_restorable' | 'unknown' => {
    if (!errorMessage) return 'unknown';
    if (errorMessage.includes('Fully Restorable')) return 'fully_restorable';
    if (errorMessage.includes('Partially Restorable')) return 'partially_restorable';
    if (errorMessage.includes('DB Only')) return 'db_only';
    return 'unknown';
  };

  const getDisplayStatus = () => {
    switch (state.status) {
      case 'idle': return { icon: <Cloud className="w-4 h-4 text-gray-500" />, label: 'Idle', color: 'text-gray-600' };
      case 'running': return { icon: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />, label: 'Running', color: 'text-blue-600' };
      case 'success': return { icon: <CheckCircle className="w-4 h-4 text-green-500" />, label: 'Success', color: 'text-green-600' };
      case 'failed': return { icon: <XCircle className="w-4 h-4 text-red-500" />, label: 'Failed', color: 'text-red-600' };
    }
  };

  const displayStatus = getDisplayStatus();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-6 h-6" />
            Backup Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {getStatusBanner()}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {displayStatus.icon}
                  <span className={`font-medium ${displayStatus.color}`}>{displayStatus.label}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
              </CardHeader>
              <CardContent>
                {state.lastBackup ? (
                  <span className="text-sm">
                    {formatDistanceToNow(new Date(state.lastBackup.completed_at || state.lastBackup.started_at), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">No backups yet</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Last Backup Size</CardTitle>
              </CardHeader>
              <CardContent>
                {state.lastBackupSize ? (
                  <span className="text-sm">{formatBytes(state.lastBackupSize)}</span>
                ) : (
                  <span className="text-muted-foreground text-sm">N/A</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Next Scheduled</CardTitle>
              </CardHeader>
              <CardContent>
                {state.nextScheduledBackup ? (
                  <span className="text-sm">
                    {format(new Date(state.nextScheduledBackup), 'MMM d, h:mm a')}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">Not scheduled</span>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileArchive className="w-4 h-4" />
                  Retained Backups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{state.backupCount}</span>
                <p className="text-xs text-muted-foreground">max {state.retentionMaxCount} days retention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Total Backup Size
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{formatBytes(state.backupTotalBytes)}</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  Retention Policy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-lg font-medium">{state.retentionPolicyDays} days FIFO</span>
                <p className="text-xs text-muted-foreground">Auto-delete oldest on new backup</p>
              </CardContent>
            </Card>
          </div>

          <Card className={state.lastBackupCompleteness === 'fully_restorable' ? 'border-green-500' : state.lastBackupCompleteness === 'partially_restorable' ? 'border-orange-500' : 'border-yellow-500'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {state.lastBackupCompleteness === 'fully_restorable' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : state.lastBackupCompleteness === 'partially_restorable' ? (
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                ) : (
                  <Clock className="w-4 h-4 text-yellow-500" />
                )}
                Last Backup Restore-Readiness
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-medium ${state.lastBackupCompleteness === 'fully_restorable' ? 'text-green-600' : state.lastBackupCompleteness === 'partially_restorable' ? 'text-orange-600' : 'text-yellow-600'}`}>
                  {state.lastBackupCompleteness === 'fully_restorable' ? 'Fully Restorable' : state.lastBackupCompleteness === 'partially_restorable' ? 'Partially Restorable' : state.lastBackupCompleteness === 'db_only' ? 'DB Only' : 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {state.lastBackupCompleteness === 'fully_restorable' 
                  ? 'All database records and media files are included in backup'
                  : state.lastBackupCompleteness === 'partially_restorable' 
                    ? 'Some media files may be missing from backup'
                    : state.lastBackupCompleteness === 'db_only'
                      ? 'Only database records backed up, no media files'
                      : 'Restore readiness unknown'}
              </p>
            </CardContent>
          </Card>

          {storage && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Storage Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{formatBytes(storage.usedBytes)} used</span>
                  <span className={`text-sm font-medium ${getStatusColor(storage.status)}`}>
                    {getStatusLabel(storage.status)}
                  </span>
                </div>
                <Progress value={storage.usagePercent} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{storage.usagePercent}% used</span>
                  <span>{formatBytes(storage.remainingBytes)} remaining</span>
                </div>
              </CardContent>
            </Card>
          )}

          {state.currentProgress && (
            <Card className={`border-blue-200 ${state.status === 'success' ? 'bg-green-50/50' : state.status === 'failed' ? 'bg-red-50/50' : 'bg-blue-50/50'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {state.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : state.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                  )}
                  {state.status === 'success' ? 'Backup Completed' : state.status === 'failed' ? 'Backup Failed' : 'Backup in Progress'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{getStageLabel(state.currentProgress.stage)}</span>
                  <span>{state.currentProgress.progress}%</span>
                </div>
                <Progress value={state.currentProgress.progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {state.currentProgress.message}
                </p>
                {state.currentProgress.error && (
                  <div className="flex items-center gap-2 text-orange-600 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {state.currentProgress.error}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleManualBackup}
              disabled={state.status === 'running'}
              className="gap-2"
            >
              <CloudDownload className="w-4 h-4" />
              Manual Backup
            </Button>
            <Button
              variant="outline"
              onClick={handleForceBackup}
              disabled={state.status === 'running'}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Force Backup
            </Button>
            <Button
              variant="outline"
              onClick={handleCleanup}
              disabled={state.status === 'running'}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Cleanup Old
            </Button>
            <Button
              variant="ghost"
              onClick={handleRefresh}
              disabled={loading || state.status === 'running'}
              className="gap-2 ml-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Backup History</h3>
            {logs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No backup logs found
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => {
                  const completeness = log.completeness || parseCompletenessFromError(log.errorMessage);
                  const completenessInfo = getCompletenessLabel(completeness);
                  return (
                    <Card key={log.id} className="hover:bg-accent/50 transition-colors">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(log.status)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium capitalize">{log.type}</span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(log.startedAt), 'MMM d, yyyy h:mm a')}
                                </span>
                                <span className={`text-xs font-medium ${completenessInfo.color}`} title={`Restore readiness: ${completenessInfo.label}`}>
                                  {completenessInfo.icon}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {log.status === 'completed' && (
                                  <>
                                    <FileArchive className="w-3 h-3 inline mr-1" />
                                    {formatBytes(log.backupSize)} • {log.fileCount} files
                                    <span className={`ml-2 font-medium ${completenessInfo.color}`}>
                                      [{completenessInfo.label}]
                                    </span>
                                    {log.retentionDeleted > 0 && (
                                      <span className="text-orange-600 ml-2">
                                        • {log.retentionDeleted} old deleted
                                      </span>
                                    )}
                                  </>
                                )}
                                {log.status === 'failed' && log.errorMessage && (
                                  <span className="text-red-600">{log.errorMessage}</span>
                                )}
                                {log.status === 'in_progress' && (
                                  <span>Processing...</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.startedAt), { addSuffix: true })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <h4 className="font-medium mb-2">Retention Policy</h4>
            <p className="text-muted-foreground">
              Automatic {state.retentionPolicyDays}-day FIFO retention: Only the latest {state.retentionMaxCount} daily backups are kept.
              When a new backup is created, the oldest backup is automatically deleted
              from Google Drive to manage storage.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
