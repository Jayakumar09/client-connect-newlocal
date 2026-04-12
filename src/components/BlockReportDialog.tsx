import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Ban } from 'lucide-react';
import { useBlockReport } from '@/hooks/useBlockReport';

interface BlockReportDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  mode: 'block' | 'report';
}

const REPORT_REASONS = [
  { value: 'fake_profile', label: 'Fake/Scam Profile' },
  { value: 'harassment', label: 'Harassment or Bullying' },
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'spam', label: 'Spam or Advertising' },
  { value: 'other', label: 'Other' },
];

const BlockReportDialog = ({ open, onClose, userId, userName, mode }: BlockReportDialogProps) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { blockUser, reportUser } = useBlockReport();

  const handleSubmit = async () => {
    setLoading(true);
    
    if (mode === 'block') {
      await blockUser(userId);
    } else {
      if (!reason) {
        setLoading(false);
        return;
      }
      await reportUser(userId, reason, description);
    }
    
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'block' ? (
              <>
                <Ban className="h-5 w-5 text-destructive" />
                Block {userName}
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Report {userName}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'block'
              ? `Are you sure you want to block ${userName}? You won't be able to message each other.`
              : `Please select a reason for reporting ${userName}. Our team will review your report.`
            }
          </DialogDescription>
        </DialogHeader>

        {mode === 'report' && (
          <div className="space-y-4">
            <RadioGroup value={reason} onValueChange={setReason}>
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value}>{r.label}</Label>
                </div>
              ))}
            </RadioGroup>

            <div className="space-y-2">
              <Label htmlFor="description">Additional details (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide more details about this report..."
                rows={3}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={mode === 'block' ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={loading || (mode === 'report' && !reason)}
          >
            {loading ? 'Please wait...' : mode === 'block' ? 'Block User' : 'Submit Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlockReportDialog;
