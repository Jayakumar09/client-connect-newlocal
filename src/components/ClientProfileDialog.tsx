import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { Shield, CreditCard, Eye, EyeOff } from "lucide-react";

type ClientProfile = Tables<"client_profiles"> & {
  match_status?: 'not_matched' | 'matched' | null;
  matched_with_id?: string | null;
  match_remarks?: string | null;
};

interface ClientProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile: ClientProfile | null;
}

const ClientProfileDialog = ({ open, onClose, profile }: ClientProfileDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'non_paid' | 'free'>('free');
  const [isProfileActive, setIsProfileActive] = useState(true);

  useEffect(() => {
    if (profile) {
      setPaymentStatus((profile.payment_status as 'paid' | 'non_paid' | 'free') || 'free');
      setIsProfileActive(profile.is_profile_active ?? true);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!profile) {
        toast.error("No profile to update");
        return;
      }

      const previousStatus = profile.payment_status;
      console.log('[ClientProfileDialog] Updating payment status via API:', {
        profileId: profile.id,
        userId: profile.user_id,
        previousPaymentStatus: previousStatus,
        newPaymentStatus: paymentStatus,
        isProfileActive: isProfileActive,
      });

      const apiKey = import.meta.env.VITE_ADMIN_API_KEY;
      const apiUrl = import.meta.env.VITE_BACKUP_API_URL || 'http://localhost:3001';
      
      if (!apiKey) {
        console.error('[ClientProfileDialog] Admin API key not configured');
        toast.error("Admin API key not configured. Please contact administrator.");
        setLoading(false);
        return;
      }

      const response = await fetch(`${apiUrl}/api/admin/update-client-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': apiKey,
        },
        body: JSON.stringify({
          profile_id: profile.id,
          payment_status: paymentStatus,
          is_profile_active: isProfileActive,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('[ClientProfileDialog] API update failed:', result);
        throw new Error(result.error || 'Failed to update payment status');
      }

      console.log('[ClientProfileDialog] Update successful via API:', {
        profileId: profile.id,
        userId: profile.user_id,
        previousPaymentStatus: previousStatus,
        newPaymentStatus: result.data.payment_status,
        serverUpdatedAt: result.data.updated_at,
      });

      toast.success("Client profile updated successfully");
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update profile";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Admin Controls
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {profile && (
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-lg">{profile.full_name}</p>
                  {profile.profile_id && (
                    <Badge variant="outline" className="font-mono">
                      {profile.profile_id}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {profile.email || profile.phone_number || 'No contact info'}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Status
              </h3>
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select
                  value={paymentStatus}
                  onValueChange={(value: 'paid' | 'non_paid' | 'free') => setPaymentStatus(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Paid {"{P}"}
                      </div>
                    </SelectItem>
                    <SelectItem value="non_paid">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Non Paid {"{NP}"}
                      </div>
                    </SelectItem>
                    <SelectItem value="free">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        Free {"{F}"}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only admin can modify payment status
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-base flex items-center gap-2">
                {isProfileActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Profile Visibility
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Profile Active</Label>
                    <p className="text-sm text-muted-foreground">
                      {isProfileActive 
                        ? "Profile is visible to other users" 
                        : "Profile is hidden from browse and search"}
                    </p>
                  </div>
                  <Switch
                    checked={isProfileActive}
                    onCheckedChange={setIsProfileActive}
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Admin can only modify payment status and profile visibility. 
                All other profile details must be edited by the client from their own dashboard.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ClientProfileDialog;
