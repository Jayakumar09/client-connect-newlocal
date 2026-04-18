import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface NotificationPreferences {
  payment_verified: boolean;
  payment_rejected: boolean;
  new_payment_submitted: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
}

const defaultPreferences: NotificationPreferences = {
  payment_verified: true,
  payment_rejected: true,
  new_payment_submitted: true,
  sound_enabled: true,
  vibration_enabled: true,
};

export const NotificationSettings = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  useEffect(() => {
    if (open) {
      fetchPreferences();
    }
  }, [open]);

  const fetchPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.debug("[NotificationSettings] Query error (normal for new users):", user.id, error.message);
    }

    if (data) {
      setPreferences({
        payment_verified: data.payment_verified,
        payment_rejected: data.payment_rejected,
        new_payment_submitted: data.new_payment_submitted,
        sound_enabled: data.sound_enabled,
        vibration_enabled: data.vibration_enabled,
      });
    } else {
      console.debug("[NotificationSettings] No preferences found → using defaults:", user.id);
      setPreferences(defaultPreferences);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setPreferences(prev => ({ ...prev, [key]: value }));
    setLoading(true);

    const { error } = await supabase
      .from("notification_preferences")
      .upsert({
        user_id: user.id,
        ...preferences,
        [key]: value,
      }, { onConflict: "user_id" });

    setLoading(false);

    if (error) {
      toast.error("Failed to update preference");
      setPreferences(prev => ({ ...prev, [key]: !value }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div>
            <h4 className="text-sm font-medium mb-4">Notification Types</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="payment_verified" className="flex-1">
                  <span className="font-medium">Payment Verified</span>
                  <p className="text-xs text-muted-foreground">When your payment is approved</p>
                </Label>
                <Switch
                  id="payment_verified"
                  checked={preferences.payment_verified}
                  onCheckedChange={(v) => updatePreference("payment_verified", v)}
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="payment_rejected" className="flex-1">
                  <span className="font-medium">Payment Rejected</span>
                  <p className="text-xs text-muted-foreground">When your payment is declined</p>
                </Label>
                <Switch
                  id="payment_rejected"
                  checked={preferences.payment_rejected}
                  onCheckedChange={(v) => updatePreference("payment_rejected", v)}
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="new_payment_submitted" className="flex-1">
                  <span className="font-medium">New Payment Submitted</span>
                  <p className="text-xs text-muted-foreground">When a client submits a payment (admin)</p>
                </Label>
                <Switch
                  id="new_payment_submitted"
                  checked={preferences.new_payment_submitted}
                  onCheckedChange={(v) => updatePreference("new_payment_submitted", v)}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-4">Alert Preferences</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="sound_enabled" className="flex-1">
                  <span className="font-medium">Sound</span>
                  <p className="text-xs text-muted-foreground">Play sound for new notifications</p>
                </Label>
                <Switch
                  id="sound_enabled"
                  checked={preferences.sound_enabled}
                  onCheckedChange={(v) => updatePreference("sound_enabled", v)}
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="vibration_enabled" className="flex-1">
                  <span className="font-medium">Vibration</span>
                  <p className="text-xs text-muted-foreground">Vibrate on new notifications (mobile)</p>
                </Label>
                <Switch
                  id="vibration_enabled"
                  checked={preferences.vibration_enabled}
                  onCheckedChange={(v) => updatePreference("vibration_enabled", v)}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
