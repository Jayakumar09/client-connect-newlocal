import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LOG_PREFIX = '[ProfileIdService]';

export class ProfileIdService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async getNextProfileId(): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('get_next_profile_id');

      if (error) {
        console.error(`${LOG_PREFIX} Error getting next Profile ID:`, error);
        throw new Error(`Failed to generate Profile ID: ${error.message}`);
      }

      if (!data) {
        throw new Error('No Profile ID returned from database');
      }

      console.log(`${LOG_PREFIX} Generated new Profile ID: ${data}`);
      return data as string;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error in getNextProfileId:`, error);
      throw error;
    }
  }

  async getSequenceStatus(): Promise<{ lastNumber: number; yearPrefix: string }> {
    try {
      const { data, error } = await this.supabase
        .from('profile_id_sequence')
        .select('last_number, year_prefix')
        .eq('id', 'global')
        .single();

      if (error) {
        console.error(`${LOG_PREFIX} Error getting sequence status:`, error);
        throw error;
      }

      return {
        lastNumber: data?.last_number || 0,
        yearPrefix: data?.year_prefix || 'VBM26'
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Error in getSequenceStatus:`, error);
      throw error;
    }
  }

  async assignProfileIdToPerson(personId: string): Promise<string> {
    const profileId = await this.getNextProfileId();

    const { error } = await this.supabase
      .from('persons')
      .update({ profile_id: profileId })
      .eq('id', personId);

    if (error) {
      console.error(`${LOG_PREFIX} Error assigning Profile ID to person:`, error);
      throw error;
    }

    return profileId;
  }

  async assignProfileIdToClientProfile(profileId: string): Promise<string> {
    const newProfileId = await this.getNextProfileId();

    const { error } = await this.supabase
      .from('client_profiles')
      .update({ profile_id: newProfileId })
      .eq('id', profileId);

    if (error) {
      console.error(`${LOG_PREFIX} Error assigning Profile ID to client profile:`, error);
      throw error;
    }

    return newProfileId;
  }

  async getPersonByProfileId(profileId: string) {
    const { data, error } = await this.supabase
      .from('persons')
      .select('*')
      .eq('profile_id', profileId)
      .single();

    if (error) {
      console.error(`${LOG_PREFIX} Error getting person by Profile ID:`, error);
      throw error;
    }

    return data;
  }

  async getClientProfileByProfileId(profileId: string) {
    const { data, error } = await this.supabase
      .from('client_profiles')
      .select('*')
      .eq('profile_id', profileId)
      .single();

    if (error) {
      console.error(`${LOG_PREFIX} Error getting client profile by Profile ID:`, error);
      throw error;
    }

    return data;
  }

  async getRecordByProfileId(profileId: string): Promise<{ type: 'person' | 'client_profile'; record: any } | null> {
    const person = await this.getPersonByProfileId(profileId).catch(() => null);
    if (person) {
      return { type: 'person', record: person };
    }

    const clientProfile = await this.getClientProfileByProfileId(profileId).catch(() => null);
    if (clientProfile) {
      return { type: 'client_profile', record: clientProfile };
    }

    return null;
  }

  formatProfileId(number: number, prefix: string = 'VBM26'): string {
    return `${prefix}_${number.toString().padStart(6, '0')}`;
  }

  parseProfileId(profileId: string): { prefix: string; number: number } | null {
    const match = profileId.match(/^([A-Z0-9]+)_(\d+)$/);
    if (!match) return null;

    return {
      prefix: match[1],
      number: parseInt(match[2], 10)
    };
  }
}

let profileIdServiceInstance: ProfileIdService | null = null;

export function getProfileIdService(): ProfileIdService {
  if (!profileIdServiceInstance) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    profileIdServiceInstance = new ProfileIdService(supabaseUrl, supabaseServiceKey);
  }

  return profileIdServiceInstance;
}
