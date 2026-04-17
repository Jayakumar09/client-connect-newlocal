import { BriefcaseBusiness, GraduationCap, Heart, MapPin, User } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import ShortlistButton from '@/components/ShortlistButton';
import SendInterestButton from '@/components/SendInterestButton';

type ClientProfile = Tables<'client_profiles'> & {
  match_status?: 'not_matched' | 'matched' | null;
  profile_id?: string;
};

interface ProfileCardMobileProps {
  profile: ClientProfile;
  onView: (profile: ClientProfile) => void;
}

const formatHeight = (cm: number | null) => {
  if (!cm) return null;
  const feet = Math.floor(cm / 30.48);
  const inches = Math.round((cm % 30.48) / 2.54);
  return `${feet}'${inches}"`;
};

const formatMaritalStatus = (status: string) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export function ProfileCardMobile({ profile, onView }: ProfileCardMobileProps) {
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

  const profilePhoto = profile.profile_photo;
  const hasProfilePhoto = profilePhoto && typeof profilePhoto === 'string' && profilePhoto.length > 0;

  return (
    <article className="overflow-hidden rounded-[24px] border border-brand-100 bg-white shadow-soft">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-brand-50">
        {hasProfilePhoto ? (
          <img
            src={profilePhoto}
            alt={profile.full_name}
            className="h-full w-full object-cover object-center-top"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100">
            <User className="h-20 w-20 text-brand-300" />
          </div>
        )}
        
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <ShortlistButton profileUserId={profile.user_id} className="h-9 w-9 rounded-full bg-white/90 text-slate-700 shadow hover:bg-white" />
        </div>
        
        <span className="absolute right-3 top-14 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-3 py-1 text-xs font-semibold text-white">
          {profile.gender === 'male' ? 'Groom' : 'Bride'}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[28px] font-bold leading-tight text-slate-900">
                {profile.full_name.toUpperCase()}
              </h2>
              {profile.profile_id && (
                <p className="mt-1 inline-flex rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600">
                  {profile.profile_id}
                </p>
              )}
            </div>
          </div>
          <p className="mt-2 text-lg text-slate-600">
            {calculateAge(profile.date_of_birth)} yrs, {formatHeight(profile.height_cm) || "Height N/A"}
          </p>
        </div>

        <div className="space-y-2.5 text-slate-600">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 text-brand-500" size={18} />
            <span className="text-base">{profile.education || 'Education not specified'}</span>
          </div>
          <div className="flex items-start gap-3">
            <BriefcaseBusiness className="mt-0.5 text-brand-500" size={18} />
            <span className="text-base">{profile.occupation || 'Occupation not specified'}</span>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 text-brand-500" size={18} />
            <span className="text-base">
              {[profile.city, profile.state].filter(Boolean).join(', ') || 'Location not specified'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700">
            {profile.religion.charAt(0).toUpperCase() + profile.religion.slice(1)}
          </span>
          {profile.caste && (
            <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-semibold text-purple-700">
              {profile.caste}
            </span>
          )}
          <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700">
            {formatMaritalStatus(profile.marital_status)}
          </span>
        </div>

        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={() => onView(profile)}
            className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-4 text-base font-semibold text-white shadow-soft transition hover:from-pink-600 hover:to-purple-600"
          >
            View Profile
          </button>
          <SendInterestButton profileUserId={profile.user_id} size="lg" variant="outline" />
        </div>
      </div>
    </article>
  );
}

export default ProfileCardMobile;
