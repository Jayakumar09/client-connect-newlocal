export interface ChatProfileInfo {
  name: string;
  photo: string | null;
  type: 'client' | 'admin' | 'unknown';
  profileId?: string;
}

export function formatChatPartnerName(profile: ChatProfileInfo, context: 'client' | 'admin' = 'client'): string {
  if (profile.type === 'admin') {
    return 'Admin';
  }
  
  if (profile.type === 'unknown') {
    return 'Unknown User';
  }
  
  if (context === 'admin' && profile.profileId) {
    return `${profile.name} / Profile ID: ${profile.profileId}`;
  }
  
  return profile.name;
}

export function getPartnerDisplayInitial(name: string): string {
  return name.charAt(0).toUpperCase() || '?';
}
