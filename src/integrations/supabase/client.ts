import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Read Vite environment variables. Vite requires the `VITE_` prefix for client-side envs.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.\n' +
      'Create a .env file (see .env.example) or set these vars in your environment.'
  );
}

export const supabase = createClient<Database>(supabaseUrl as string, supabaseKey as string, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
