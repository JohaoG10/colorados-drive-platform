import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './index';

/**
 * Supabase client with service role (full access, for backend operations)
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Supabase client with anon key (for auth operations that need public scope)
 */
export const supabaseAnon: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey
);
