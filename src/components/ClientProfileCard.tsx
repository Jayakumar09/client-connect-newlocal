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

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 bg-white/90 backdrop-blur-sm border-pink-100">
      <div className="relative">
        {profile.profile_photo ? (
          <img
            src={profile.profile_photo}
            alt={profile.full_name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
            <User className="h-20 w-20 text-pink-300" />
          </div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <ShortlistButton profileUserId={profile.user_id} className="bg-white/80 hover:bg-white" />
          <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white">
            {profile.gender === "male" ? "Groom" : "Bride"}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-lg text-gray-800 truncate">{profile.full_name}</h3>
          {profile.profile_id && (
            <Badge variant="outline" className="text-xs font-mono mt-1">
              {profile.profile_id}
            </Badge>
          )}
          <p className="text-sm text-muted-foreground">
            {calculateAge(profile.date_of_birth)} yrs, {formatHeight(profile.height_cm) || "Height N/A"}
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="h-4 w-4 text-pink-500" />
            <span className="truncate">{profile.education || "Education not specified"}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-4 w-4 text-pink-500" />
            <span className="truncate">{profile.occupation || "Occupation not specified"}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-pink-500" />
            <span className="truncate">
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

      <CardFooter className="p-4 pt-0 flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Button 
            onClick={() => onView(profile)} 
            className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Profile
          </Button>
        </div>
        <SendInterestButton profileUserId={profile.user_id} size="sm" />
      </CardFooter>
    </Card>
  );
};

export default ClientProfileCard;
