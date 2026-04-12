import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StorageSummary, getStatusLabel, getStatusColor, getWarningMessage } from '@/hooks/useStorageSummary';
import { formatBytesUtil } from '@/hooks/useStorageSummary';
import { AlertTriangle, CheckCircle, Info, XCircle, HardDrive } from 'lucide-react';

interface StorageSummaryCardProps {
  storage: StorageSummary | null;
  loading?: boolean;
  compact?: boolean;
  showWarnings?: boolean;
  className?: string;
}

export function StorageSummaryCard({ 
  storage, 
  loading = false, 
  compact = false,
  showWarnings = true,
  className = ''
}: StorageSummaryCardProps) {
  
  if (loading || !storage) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            Storage Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-2 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusColor = getStatusColor(storage.status);
  const statusLabel = getStatusLabel(storage.status);
  const warningMessage = getWarningMessage(storage.warningLevel);

  const getStatusIcon = () => {
    switch (storage.status) {
      case 'healthy': return <CheckCircle className={`w-4 h-4 ${statusColor}`} />;
      case 'moderate': return <Info className={`w-4 h-4 ${statusColor}`} />;
      case 'warning': return <AlertTriangle className={`w-4 h-4 ${statusColor}`} />;
      case 'critical':
      case 'limit_reached': return <XCircle className={`w-4 h-4 ${statusColor}`} />;
      default: return <HardDrive className="w-4 h-4" />;
    }
  };

  const getProgressColor = () => {
    switch (storage.status) {
      case 'healthy': return 'bg-green-500';
      case 'moderate': return 'bg-blue-500';
      case 'warning': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      case 'limit_reached': return 'bg-red-800';
      default: return 'bg-gray-500';
    }
  };

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatBytesUtil(storage.usedBytes)} / {formatBytesUtil(storage.totalBytes)}
            </span>
          </div>
          <Progress 
            value={storage.usagePercent} 
            className="h-2 mt-2"
            indicatorClassName={getProgressColor()}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <HardDrive className="w-4 h-4" />
          Storage Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
          </div>
          <span className="text-2xl font-bold">{storage.usagePercent.toFixed(1)}%</span>
        </div>

        <div className="space-y-1">
          <Progress 
            value={storage.usagePercent} 
            className="h-3"
            indicatorClassName={getProgressColor()}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Used: {formatBytesUtil(storage.usedBytes)}</span>
            <span>Total: {formatBytesUtil(storage.totalBytes)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Remaining</span>
            <p className="font-medium">{formatBytesUtil(storage.remainingBytes)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Profile Files</span>
            <p className="font-medium">{storage.profileAssetCount} ({formatBytesUtil(storage.profileAssetBytes)})</p>
          </div>
          <div>
            <span className="text-muted-foreground">DB Records</span>
            <p className="font-medium">{storage.dbRecordCount.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Last Updated</span>
            <p className="font-medium text-xs">{new Date(storage.lastUpdated).toLocaleTimeString()}</p>
          </div>
        </div>

        {showWarnings && warningMessage && (
          <Alert variant={storage.status === 'limit_reached' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {warningMessage}
              {storage.status === 'limit_reached' && ' Upgrade required to continue uploads.'}
            </AlertDescription>
          </Alert>
        )}

        {storage.warningLevel !== 'none' && storage.warningLevel !== '100' && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Warning thresholds:</p>
            <div className="flex gap-2 flex-wrap">
              <span className={storage.usagePercent >= 70 ? 'text-orange-600 font-medium' : ''}>70%</span>
              <span className={storage.usagePercent >= 85 ? 'text-orange-600 font-medium' : ''}>85%</span>
              <span className={storage.usagePercent >= 95 ? 'text-red-600 font-medium' : ''}>95%</span>
              <span className={storage.usagePercent >= 100 ? 'text-red-800 font-medium' : ''}>100%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StorageSummaryBadgeProps {
  storage: StorageSummary | null;
  loading?: boolean;
}

export function StorageSummaryBadge({ storage, loading }: StorageSummaryBadgeProps) {
  if (loading || !storage) {
    return <span className="text-muted-foreground">Loading...</span>;
  }

  const statusColor = getStatusColor(storage.status);
  const label = getStatusLabel(storage.status);

  return (
    <span className={`inline-flex items-center gap-1 ${statusColor}`}>
      {storage.status === 'healthy' && <CheckCircle className="w-3 h-3" />}
      {storage.status !== 'healthy' && <AlertTriangle className="w-3 h-3" />}
      {label}: {storage.usagePercent.toFixed(1)}%
    </span>
  );
}