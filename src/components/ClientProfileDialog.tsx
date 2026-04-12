import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables, Constants } from "@/integrations/supabase/types";

type ClientProfile = Tables<"client_profiles">;

interface ClientProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile: ClientProfile | null;
}

const ClientProfileDialog = ({ open, onClose, profile }: ClientProfileDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<ClientProfile>>({
    full_name: "",
    gender: "male",
    date_of_birth: "",
    religion: "hindu",
    marital_status: "never_married",
    phone_number: "",
    email: "",
    education: "",
    occupation: "",
    annual_income: "",
    city: "",
    state: "",
    country: "India",
    height_cm: null,
    weight_kg: null,
    complexion: null,
    caste: "",
    sub_caste: "",
    mother_tongue: "",
    star: "",
    rasi: "",
    birth_time: "",
    birth_place: "",
    working_location: "",
    father_name: "",
    father_occupation: "",
    mother_name: "",
    mother_occupation: "",
    number_of_brothers: 0,
    number_of_sisters: 0,
    about_me: "",
    partner_expectations: "",
    show_phone_number: false,
    is_profile_active: true,
    payment_status: "free",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        ...profile,
        date_of_birth: profile.date_of_birth ? new Date(profile.date_of_birth).toISOString().split('T')[0] : "",
      });
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

      const { error } = await supabase
        .from("client_profiles")
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ClientProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl">Edit Client Profile</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Payment Status - Admin Only */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-3">Admin Controls</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Status</Label>
                  <Select
                    value={formData.payment_status || "free"}
                    onValueChange={(value) => handleInputChange("payment_status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid {"{P}"}</SelectItem>
                      <SelectItem value="non_paid">Non Paid {"{NP}"}</SelectItem>
                      <SelectItem value="free">Free {"{F}"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Profile Status</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      checked={formData.is_profile_active ?? true}
                      onCheckedChange={(checked) => handleInputChange("is_profile_active", checked)}
                    />
                    <span className="text-sm">{formData.is_profile_active ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={formData.full_name || ""}
                    onChange={(e) => handleInputChange("full_name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender *</Label>
                  <Select
                    value={formData.gender || "male"}
                    onValueChange={(value) => handleInputChange("gender", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.gender.map((g) => (
                        <SelectItem key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth *</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth || ""}
                    onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marital Status *</Label>
                  <Select
                    value={formData.marital_status || "never_married"}
                    onValueChange={(value) => handleInputChange("marital_status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.marital_status.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Height (cm)</Label>
                  <Input
                    type="number"
                    value={formData.height_cm || ""}
                    onChange={(e) => handleInputChange("height_cm", e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    value={formData.weight_kg || ""}
                    onChange={(e) => handleInputChange("weight_kg", e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Complexion</Label>
                  <Select
                    value={formData.complexion || ""}
                    onValueChange={(value) => handleInputChange("complexion", value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select complexion" />
                    </SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.complexion.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={formData.phone_number || ""}
                    onChange={(e) => handleInputChange("phone_number", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Switch
                    checked={formData.show_phone_number ?? false}
                    onCheckedChange={(checked) => handleInputChange("show_phone_number", checked)}
                  />
                  <Label>Show phone number to other users</Label>
                </div>
              </div>
            </div>

            {/* Religious Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Religious Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Religion *</Label>
                  <Select
                    value={formData.religion || "hindu"}
                    onValueChange={(value) => handleInputChange("religion", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.religion.map((r) => (
                        <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Caste</Label>
                  <Input
                    value={formData.caste || ""}
                    onChange={(e) => handleInputChange("caste", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sub Caste</Label>
                  <Input
                    value={formData.sub_caste || ""}
                    onChange={(e) => handleInputChange("sub_caste", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mother Tongue</Label>
                  <Input
                    value={formData.mother_tongue || ""}
                    onChange={(e) => handleInputChange("mother_tongue", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Star</Label>
                  <Input
                    value={formData.star || ""}
                    onChange={(e) => handleInputChange("star", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rasi</Label>
                  <Input
                    value={formData.rasi || ""}
                    onChange={(e) => handleInputChange("rasi", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Birth Time</Label>
                  <Input
                    type="time"
                    value={formData.birth_time || ""}
                    onChange={(e) => handleInputChange("birth_time", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Birth Place</Label>
                  <Input
                    value={formData.birth_place || ""}
                    onChange={(e) => handleInputChange("birth_place", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Professional Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Education</Label>
                  <Input
                    value={formData.education || ""}
                    onChange={(e) => handleInputChange("education", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Occupation</Label>
                  <Input
                    value={formData.occupation || ""}
                    onChange={(e) => handleInputChange("occupation", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Annual Income</Label>
                  <Input
                    value={formData.annual_income || ""}
                    onChange={(e) => handleInputChange("annual_income", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Working Location</Label>
                  <Input
                    value={formData.working_location || ""}
                    onChange={(e) => handleInputChange("working_location", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Location</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={formData.city || ""}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={formData.state || ""}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={formData.country || "India"}
                    onChange={(e) => handleInputChange("country", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Family Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Family Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Father's Name</Label>
                  <Input
                    value={formData.father_name || ""}
                    onChange={(e) => handleInputChange("father_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Father's Occupation</Label>
                  <Input
                    value={formData.father_occupation || ""}
                    onChange={(e) => handleInputChange("father_occupation", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mother's Name</Label>
                  <Input
                    value={formData.mother_name || ""}
                    onChange={(e) => handleInputChange("mother_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mother's Occupation</Label>
                  <Input
                    value={formData.mother_occupation || ""}
                    onChange={(e) => handleInputChange("mother_occupation", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of Brothers</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.number_of_brothers ?? 0}
                    onChange={(e) => handleInputChange("number_of_brothers", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number of Sisters</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.number_of_sisters ?? 0}
                    onChange={(e) => handleInputChange("number_of_sisters", parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* About & Expectations */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">About & Expectations</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>About Me</Label>
                  <Textarea
                    value={formData.about_me || ""}
                    onChange={(e) => handleInputChange("about_me", e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Partner Expectations</Label>
                  <Textarea
                    value={formData.partner_expectations || ""}
                    onChange={(e) => handleInputChange("partner_expectations", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
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