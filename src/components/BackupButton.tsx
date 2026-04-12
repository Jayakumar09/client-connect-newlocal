import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBackup, BackupProgress } from '@/contexts/BackupContext';
import { toast } from 'sonner';
import {
  Cloud,
  CloudDownload,
  RefreshCw,
  MoreVertical,
  Check,
  X,
  AlertCircle,
  Trash2
} from 'lucide-react';
import BackupDialog from './BackupDialog';

export function BackupButton() {
  const { state, triggerBackup, runCleanup } = useBackup();
  const [showDialog, setShowDialog] = useState(false);
  const [showForceConfirm, setShowForceConfirm] = useState(false);

  const handleManualBackup = () => {
    triggerBackup(false);
  };

  const handleForceBackup = () => {
    setShowForceConfirm(false);
    triggerBackup(true);
  };

  const getProgressMessage = (progress: BackupProgress | null) => {
    if (!progress) return '';
    return `${progress.message} (${progress.progress}%)`;
  };

  const getStatusIcon = () => {
    if (!state.lastBackup) return <Cloud className="w-4 h-4" />;
    switch (state.lastBackup.status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Cloud className="w-4 h-4" />;
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setShowDialog(true)}
          className="gap-2"
        >
          {getStatusIcon()}
          <span>Backup</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleManualBackup} disabled={state.isRunning}>
              <CloudDownload className="w-4 h-4 mr-2" />
              Manual Backup
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowForceConfirm(true)} disabled={state.isRunning}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Force Backup (Today)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={runCleanup}>
              <Trash2 className="w-4 h-4 mr-2" />
              Cleanup Old Backups
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowDialog(true)}>
              <AlertCircle className="w-4 h-4 mr-2" />
              View Backup Logs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showForceConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md">
            <h3 className="text-lg font-semibold mb-2">Force Backup</h3>
            <p className="text-muted-foreground mb-4">
              A backup already exists for today. Creating a new one will replace it.
              Are you sure you want to continue?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForceConfirm(false)}>
                Cancel
              </Button>
              <Button onClick={handleForceBackup}>
                Create Backup
              </Button>
            </div>
          </div>
        </div>
      )}

      <BackupDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
      />
    </>
  );
}
