import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SafeSupabase {
  client: SupabaseClient | null;
  isConfigured: boolean;
}

export function useSupabase(): SafeSupabase {
  return useMemo(() => ({
    client: supabase,
    isConfigured: supabase !== null,
  }), []);
}
