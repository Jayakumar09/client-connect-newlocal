import type { ClientProfile } from '@/pages/ClientProfile';

export interface ProfileSectionStatus {
  name: string;
  complete: boolean;
  fields: string[];
  missingFields: string[];
}

export interface ProfileCompletionBreakdown {
  totalSections: number;
  completedSections: number;
  percentage: number;
  sections: ProfileSectionStatus[];
}

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function isBasicComplete(profile: Partial<ClientProfile>): boolean {
  return isFilled(profile.full_name) &&
         isFilled(profile.email) &&
         isFilled(profile.phone_number) &&
         isFilled(profile.date_of_birth) &&
         isFilled(profile.gender) &&
         isFilled(profile.religion);
}

export function isPersonalComplete(profile: Partial<ClientProfile>): boolean {
  return isFilled(profile.caste) &&
         isFilled(profile.mother_tongue) &&
         isFilled(profile.height_cm) &&
         isFilled(profile.weight_kg) &&
         isFilled(profile.complexion) &&
         isFilled(profile.marital_status);
}

export function isEducationComplete(profile: Partial<ClientProfile>): boolean {
  return isFilled(profile.education) &&
         isFilled(profile.occupation) &&
         isFilled(profile.annual_income);
}

export function isLocationComplete(profile: Partial<ClientProfile>): boolean {
  return isFilled(profile.city) &&
         isFilled(profile.state) &&
         isFilled(profile.country);
}

export function isFamilyComplete(profile: Partial<ClientProfile>): boolean {
  return isFilled(profile.father_name) &&
         isFilled(profile.mother_name) &&
         isFilled(profile.number_of_brothers) &&
         isFilled(profile.number_of_sisters);
}

export function isAboutComplete(profile: Partial<ClientProfile>): boolean {
  return isFilled(profile.about_me);
}

export function isPhotosComplete(profile: Partial<ClientProfile>): boolean {
  return isFilled(profile.profile_photo);
}

export function isGalleryComplete(profile: Partial<ClientProfile>): boolean {
  const gallery = profile.gallery_images;
  return Array.isArray(gallery) && gallery.length > 0;
}

export function getProfileCompletionBreakdown(profile: Partial<ClientProfile>): ProfileCompletionBreakdown {
  if (!profile) {
    return {
      totalSections: 8,
      completedSections: 0,
      percentage: 0,
      sections: []
    };
  }

  const sections: ProfileSectionStatus[] = [
    {
      name: 'Basic Information',
      complete: isBasicComplete(profile),
      fields: ['full_name', 'email', 'phone_number', 'date_of_birth', 'gender', 'religion'],
      missingFields: []
    },
    {
      name: 'Personal Details',
      complete: isPersonalComplete(profile),
      fields: ['caste', 'mother_tongue', 'height_cm', 'weight_kg', 'complexion', 'marital_status'],
      missingFields: []
    },
    {
      name: 'Career & Education',
      complete: isEducationComplete(profile),
      fields: ['education', 'occupation', 'annual_income'],
      missingFields: []
    },
    {
      name: 'Location',
      complete: isLocationComplete(profile),
      fields: ['city', 'state', 'country'],
      missingFields: []
    },
    {
      name: 'Family Details',
      complete: isFamilyComplete(profile),
      fields: ['father_name', 'mother_name', 'number_of_brothers', 'number_of_sisters'],
      missingFields: []
    },
    {
      name: 'About Me',
      complete: isAboutComplete(profile),
      fields: ['about_me'],
      missingFields: []
    },
    {
      name: 'Profile Photo',
      complete: isPhotosComplete(profile),
      fields: ['profile_photo'],
      missingFields: []
    },
    {
      name: 'Gallery',
      complete: isGalleryComplete(profile),
      fields: ['gallery_images'],
      missingFields: []
    }
  ];

  // Calculate missing fields for each section
  sections.forEach(section => {
    section.missingFields = section.fields.filter(field => !isFilled(profile[field as keyof ClientProfile]));
  });

  const completedSections = sections.filter(s => s.complete).length;
  const totalSections = sections.length;
  const percentage = Math.round((completedSections / totalSections) * 100);

  console.log('[ProfileCompletion] Breakdown:', {
    totalSections,
    completedSections,
    percentage,
    sections: sections.map(s => ({ name: s.name, complete: s.complete, missing: s.missingFields }))
  });

  return {
    totalSections,
    completedSections,
    percentage,
    sections
  };
}

export function calculateProfileCompletion(profile: Partial<ClientProfile>): number {
  const breakdown = getProfileCompletionBreakdown(profile);
  return breakdown.percentage;
}