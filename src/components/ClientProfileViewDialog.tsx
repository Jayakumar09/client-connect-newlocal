import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { User, Phone, Mail, MapPin, Briefcase, GraduationCap, Heart, Users, Star, Eye, Download, MessageSquare, Ban, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ShortlistButton from "./ShortlistButton";
import BlockReportDialog from "./BlockReportDialog";
import SendInterestButton from "./SendInterestButton";

type ClientProfile = Tables<"client_profiles"> & {
  match_status?: 'not_matched' | 'matched' | null;
  matched_with_id?: string | null;
  match_remarks?: string | null;
};

interface ClientProfileViewDialogProps {
  profile: ClientProfile | null;
  open: boolean;
  onClose: () => void;
  onMarkMatched?: (profile: ClientProfile) => void;
}

const ClientProfileViewDialog = ({ profile, open, onClose, onMarkMatched }: ClientProfileViewDialogProps) => {
  const navigate = useNavigate();
  const [sendingMessage, setSendingMessage] = useState(false);
  const [blockReportMode, setBlockReportMode] = useState<'block' | 'report' | null>(null);
  const isMatched = profile?.match_status === 'matched';

  if (!profile) return null;

  const handleStartChat = async () => {
    setSendingMessage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please login to send messages");
        return;
      }
      
      // Navigate to messages page - the conversation will be created when first message is sent
      onClose();
      navigate("/messages");
      toast.success(`Starting conversation with ${profile.full_name}`);
    } catch (error) {
      console.error("Error starting chat:", error);
      toast.error("Failed to start conversation");
    } finally {
      setSendingMessage(false);
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatHeight = (cm: number | null) => {
    if (!cm) return "N/A";
    const feet = Math.floor(cm / 30.48);
    const inches = Math.round((cm % 30.48) / 2.54);
    return `${feet}'${inches}" (${cm} cm)`;
  };

  const formatValue = (value: string | number | null | undefined, suffix?: string) => {
    if (value === null || value === undefined || value === "") return "Not specified";
    return suffix ? `${value} ${suffix}` : String(value);
  };

  const formatEnum = (value: string) => {
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-pink-500" />
        <h3 className="font-semibold text-pink-700">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">{children}</div>
    </div>
  );

  const InfoItem = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Profile Details
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="p-6 space-y-6">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0">
                {profile.profile_photo ? (
                  <div className="relative w-40 h-40 overflow-hidden rounded-lg border-4 border-pink-200">
                    <img
                      src={profile.profile_photo}
                      alt={profile.full_name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-6 px-1.5 text-[10px] bg-teal-600 hover:bg-teal-700 flex-1"
                        onClick={() => window.open(profile.profile_photo!, '_blank')}
                      >
                        <Eye className="w-3 h-3 mr-0.5" />
                        View Only
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-6 px-1.5 text-[10px] bg-blue-600 hover:bg-blue-700 flex-1"
                        onClick={() => {
                          const fileName = `${profile.full_name.replace(/\s+/g, '_')}_profile.jpg`;
                          fetch(profile.profile_photo!)
                            .then(res => res.blob())
                            .then(blob => {
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(blob);
                              link.download = fileName;
                              link.click();
                              URL.revokeObjectURL(link.href);
                              toast.success(`Downloaded ${fileName}`);
                            })
                            .catch(() => toast.error("Failed to download image"));
                        }}
                      >
                        <Download className="w-3 h-3 mr-0.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center border-4 border-pink-200">
                    <User className="h-16 w-16 text-pink-300" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-800">{profile.full_name}</h2>
                    {isMatched && (
                      <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Matched
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge className="bg-gradient-to-r from-pink-500 to-purple-500">
                      {profile.gender === "male" ? "Groom" : "Bride"}
                    </Badge>
                    <Badge variant="outline" className="border-pink-200">
                      {formatEnum(profile.marital_status)}
                    </Badge>
                    <Badge variant="outline" className="border-purple-200">
                      {formatEnum(profile.religion)}
                    </Badge>
                    {profile.profile_id && (
                      <Badge variant="outline" className="font-mono border-blue-200">
                        {profile.profile_id}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Match Information */}
                {isMatched && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 text-green-700 font-medium mb-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Matched Successfully
                    </div>
                    {profile.matched_at && (
                      <p className="text-green-600 text-xs">
                        On: {new Date(profile.matched_at).toLocaleDateString()} by {profile.matched_by || 'Admin'}
                      </p>
                    )}
                    {profile.match_remarks && (
                      <p className="text-green-600 text-xs mt-1">
                        Note: {profile.match_remarks}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Age:</span>
                    <span className="font-medium">{calculateAge(profile.date_of_birth)} years</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Height:</span>
                    <span className="font-medium">{formatHeight(profile.height_cm)}</span>
                  </div>
                </div>

                {profile.show_phone_number && profile.phone_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-pink-500" />
                    <span>{profile.country_code} {profile.phone_number}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  {!isMatched && onMarkMatched && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => onMarkMatched(profile)}
                    >
                      <Heart className="h-4 w-4 mr-1" />
                      Mark as Matched
                    </Button>
                  )}
                  {!isMatched && <SendInterestButton profileUserId={profile.user_id} />}
                  {!isMatched && (
                    <Button
                      onClick={handleStartChat}
                      disabled={sendingMessage}
                      variant="outline"
                      className="flex-1"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {sendingMessage ? "Starting..." : "Message"}
                    </Button>
                  )}
                </div>
                {!isMatched && (
                  <div className="flex gap-2 flex-wrap">
                    <ShortlistButton profileUserId={profile.user_id} variant="full" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBlockReportMode('block')}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Block
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBlockReportMode('report')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Report
                  </Button>
                </div>
              </div>
            </div>

            {/* Gallery Images */}
            {profile.gallery_images && profile.gallery_images.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-pink-700">Gallery</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {profile.gallery_images.map((url, index) => (
                      <div key={index} className="relative h-32 overflow-hidden rounded-lg border border-pink-100">
                        <img
                          src={url}
                          alt={`Gallery ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-6 px-1.5 text-[10px] bg-teal-600 hover:bg-teal-700 flex-1"
                            onClick={() => window.open(url, '_blank')}
                          >
                            <Eye className="w-3 h-3 mr-0.5" />
                            View Only
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-6 px-1.5 text-[10px] bg-blue-600 hover:bg-blue-700 flex-1"
                            onClick={() => {
                              const fileName = `${profile.full_name.replace(/\s+/g, '_')}_gallery${index + 1}.jpg`;
                              fetch(url)
                                .then(res => res.blob())
                                .then(blob => {
                                  const link = document.createElement('a');
                                  link.href = URL.createObjectURL(blob);
                                  link.download = fileName;
                                  link.click();
                                  URL.revokeObjectURL(link.href);
                                  toast.success(`Downloaded ${fileName}`);
                                })
                                .catch(() => toast.error("Failed to download image"));
                            }}
                          >
                            <Download className="w-3 h-3 mr-0.5" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Basic Information */}
            <Section title="Basic Information" icon={User}>
              <InfoItem label="Date of Birth" value={new Date(profile.date_of_birth).toLocaleDateString()} />
              <InfoItem label="Weight" value={formatValue(profile.weight_kg, "kg")} />
              <InfoItem label="Complexion" value={formatValue(profile.complexion ? formatEnum(profile.complexion) : null)} />
              <InfoItem label="Mother Tongue" value={formatValue(profile.mother_tongue)} />
            </Section>

            <Separator />

            {/* Religious Information */}
            <Section title="Religious Information" icon={Star}>
              <InfoItem label="Religion" value={formatEnum(profile.religion)} />
              <InfoItem label="Caste" value={formatValue(profile.caste)} />
              <InfoItem label="Sub Caste" value={formatValue(profile.sub_caste)} />
              <InfoItem label="Star" value={formatValue(profile.star)} />
              <InfoItem label="Rasi" value={formatValue(profile.rasi)} />
              <InfoItem label="Birth Time" value={formatValue(profile.birth_time)} />
              <InfoItem label="Birth Place" value={formatValue(profile.birth_place)} />
            </Section>

            <Separator />

            {/* Professional Information */}
            <Section title="Professional Information" icon={Briefcase}>
              <InfoItem label="Education" value={formatValue(profile.education)} />
              <InfoItem label="Occupation" value={formatValue(profile.occupation)} />
              <InfoItem label="Annual Income" value={formatValue(profile.annual_income)} />
              <InfoItem label="Working Location" value={formatValue(profile.working_location)} />
            </Section>

            <Separator />

            {/* Location */}
            <Section title="Location" icon={MapPin}>
              <InfoItem label="City" value={formatValue(profile.city)} />
              <InfoItem label="State" value={formatValue(profile.state)} />
              <InfoItem label="Country" value={formatValue(profile.country)} />
            </Section>

            <Separator />

            {/* Family Information */}
            <Section title="Family Information" icon={Users}>
              <InfoItem label="Father's Name" value={formatValue(profile.father_name)} />
              <InfoItem label="Father's Occupation" value={formatValue(profile.father_occupation)} />
              <InfoItem label="Mother's Name" value={formatValue(profile.mother_name)} />
              <InfoItem label="Mother's Occupation" value={formatValue(profile.mother_occupation)} />
              <InfoItem label="Brothers" value={String(profile.number_of_brothers ?? 0)} />
              <InfoItem label="Sisters" value={String(profile.number_of_sisters ?? 0)} />
            </Section>

            {/* About Me */}
            {profile.about_me && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-pink-500" />
                    <h3 className="font-semibold text-pink-700">About Me</h3>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{profile.about_me}</p>
                </div>
              </>
            )}

            {/* Partner Expectations */}
            {profile.partner_expectations && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-pink-500" />
                    <h3 className="font-semibold text-pink-700">Partner Expectations</h3>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{profile.partner_expectations}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>

      {/* Block/Report Dialog */}
      {blockReportMode && (
        <BlockReportDialog
          open={!!blockReportMode}
          onClose={() => setBlockReportMode(null)}
          userId={profile.user_id}
          userName={profile.full_name}
          mode={blockReportMode}
        />
      )}
    </Dialog>
  );
};

export default ClientProfileViewDialog;
