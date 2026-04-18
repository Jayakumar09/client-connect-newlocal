import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, MapPin, Briefcase, GraduationCap, User } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import ShortlistButton from "./ShortlistButton";
import SendInterestButton from "./SendInterestButton";

type ClientProfile = Tables<"client_profiles"> & {
  match_status?: 'not_matched' | 'matched' | null;
  matched_with_id?: string | null;
  match_remarks?: string | null;
};

interface ClientProfileCardProps {
  profile: ClientProfile;
  onView: (profile: ClientProfile) => void;
}

const ClientProfileCard = ({ profile, onView }: ClientProfileCardProps) => {
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
    if (!cm) return null;
    const feet = Math.floor(cm / 30.48);
    const inches = Math.round((cm % 30.48) / 2.54);
    return `${feet}'${inches}"`;
  };

  const formatReligion = (religion: string) => {
    return religion.charAt(0).toUpperCase() + religion.slice(1);
  };

  const formatMaritalStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const isValidImageUrl = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string') return false;
    try {
      const urlObj = new URL(url);
      const ext = urlObj.pathname.toLowerCase().split('.').pop();
      return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '');
    } catch {
      return false;
    }
  };

  const profilePhoto = isValidImageUrl(profile.profile_photo) ? profile.profile_photo : null;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 bg-white/90 backdrop-blur-sm border-pink-100 flex flex-col">
      <div className="relative w-full aspect-[4/5] flex-shrink-0 overflow-hidden bg-gray-100 rounded-t-lg">
        <div className="absolute inset-0">
          {profilePhoto ? (
            <img
              src={profilePhoto}
              alt={profile.full_name}
              className="w-full h-full object-cover object-center-top"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
              <User className="h-10 w-10 sm:h-12 sm:w-12 text-pink-300" />
            </div>
          )}
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <ShortlistButton profileUserId={profile.user_id} className="bg-white/80 hover:bg-white" />
          <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white">
            {profile.gender === "male" ? "Groom" : "Bride"}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3 flex-1 overflow-hidden">
        <div>
          <h3 className="font-semibold text-base sm:text-lg text-gray-800 truncate">{profile.full_name}</h3>
          {profile.profile_id && (
            <Badge variant="outline" className="text-xs font-mono mt-1">
              {profile.profile_id}
            </Badge>
          )}
          <p className="text-sm text-muted-foreground">
            {calculateAge(profile.date_of_birth)} yrs, {formatHeight(profile.height_cm) || "Height N/A"}
          </p>
        </div>

        <div className="space-y-1 sm:space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-pink-500 flex-shrink-0" />
            <span className="truncate text-xs sm:text-sm">{profile.education || "Education not specified"}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-pink-500 flex-shrink-0" />
            <span className="truncate text-xs sm:text-sm">{profile.occupation || "Occupation not specified"}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-pink-500 flex-shrink-0" />
            <span className="truncate text-xs sm:text-sm">
              {[profile.city, profile.state].filter(Boolean).join(", ") || "Location not specified"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs border-pink-200 text-pink-700">
            {formatReligion(profile.religion)}
          </Badge>
          {profile.caste && (
            <Badge variant="outline" className="text-xs border-purple-200 text-purple-700">
              {profile.caste}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs border-pink-200 text-pink-700">
            {formatMaritalStatus(profile.marital_status)}
          </Badge>
        </div>
      </CardContent>

      <CardFooter className="p-3 sm:p-4 pt-0 flex flex-col gap-2 flex-shrink-0">
        <div className="flex gap-2 w-full">
          <Button 
            onClick={() => onView(profile)} 
            className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-sm"
          >
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            View Profile
          </Button>
        </div>
        <SendInterestButton profileUserId={profile.user_id} size="sm" />
      </CardFooter>
    </Card>
  );
};

export default ClientProfileCard;
