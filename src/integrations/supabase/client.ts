import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Required environment variables for frontend
const REQUIRED_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

export function getMissingEnvVars(): string[] {
  return REQUIRED_VARS.filter((v) => !import.meta.env[v]).map((v) => v);
}

export function isConfigured(): boolean {
  return getMissingEnvVars().length === 0;
}

// Create Supabase client with validation
function createSupabaseClient(): SupabaseClient<Database> | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] Missing required environment variables:', getMissingEnvVars());
    return null;
  }

  // Validate URL format and log for debugging
  const urlValid = supabaseUrl.startsWith('https://');
  console.log('[Supabase] Initializing with URL:', supabaseUrl);
  console.log('[Supabase] URL valid (https):', urlValid);
  console.log('[Supabase] Key prefix:', supabaseKey.substring(0, 15) + '...');

  if (!urlValid) {
    console.error('[Supabase] ERROR: URL must start with https:// - this will cause ERR_NAME_NOT_RESOLVED');
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

// Export client that may be null if not configured
export const supabase: SupabaseClient<Database> | null = createSupabaseClient();

// Named export for safe usage
export { supabase as supabaseClient };
