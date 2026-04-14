import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Heart, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MatchDialogProps {
  open: boolean;
  onClose: () => void;
  profileType: "person" | "client_profile";
  profileId: string;
  profileName: string;
  profileCode: string;
  onMatchSuccess: () => void;
}

const MatchDialog = ({
  open,
  onClose,
  profileType,
  profileId,
  profileName,
  profileCode,
  onMatchSuccess,
}: MatchDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [matchedWithCode, setMatchedWithCode] = useState("");

  const handleConfirm = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please login to continue");
        return;
      }

      const adminEmail = user.email || "admin";

      const updateData: any = {
        match_status: "matched",
        matched_at: new Date().toISOString(),
        matched_by: adminEmail,
        match_remarks: remarks || null,
      };

      if (matchedWithCode.trim()) {
        try {
          const { data: matchedPerson } = await supabase
            .from("persons")
            .select("id")
            .eq("profile_id", matchedWithCode.trim())
            .single();

          const { data: matchedClient } = await supabase
            .from("client_profiles")
            .select("id")
            .eq("profile_id", matchedWithCode.trim())
            .single();

          if (matchedPerson) {
            updateData.matched_with_id = matchedPerson.id;
          } else if (matchedClient) {
            updateData.matched_with_id = matchedClient.id;
          }
        } catch (lookupError) {
          console.warn("Profile ID lookup failed (column may not exist yet):", lookupError);
        }
      }

      const tableName = profileType === "person" ? "persons" : "client_profiles";
      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq("id", profileId);

      if (error) throw error;

      toast.success("Profile marked as matched successfully!");
      onMatchSuccess();
      handleClose();
    } catch (error) {
      console.error("Error marking profile as matched:", error);
      toast.error("Failed to mark profile as matched. Please ensure the database migration has been run.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRemarks("");
    setMatchedWithCode("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100">
              <Heart className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle>Mark as Matched</DialogTitle>
              <DialogDescription>
                Confirm this profile has been successfully matched/married
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Profile Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Profile:</span>
              <Badge variant="outline" className="font-mono">
                {profileCode}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Name:</span>
              <span className="font-medium">{profileName}</span>
            </div>
          </div>

          {/* Confirmation Message */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              Are you sure this profile is successfully matched/married? This action will:
            </p>
            <ul className="text-xs text-amber-700 mt-2 space-y-1 list-disc list-inside">
              <li>Change status to "Matched"</li>
              <li>Record match date and admin</li>
              <li>Restrict further editing</li>
            </ul>
          </div>

          {/* Optional: Link to matched profile */}
          <div className="space-y-2">
            <Label htmlFor="matchedWith" className="text-sm">
              Matched With (Optional - Profile ID)
            </Label>
            <Input
              id="matchedWith"
              placeholder="e.g., VBM26_000001"
              value={matchedWithCode}
              onChange={(e) => setMatchedWithCode(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Enter the Profile ID of the matched partner (optional)
            </p>
          </div>

          {/* Optional: Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks" className="text-sm">
              Remarks (Optional)
            </Label>
            <Textarea
              id="remarks"
              placeholder="Add any notes about the match..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm Match
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MatchDialog;
