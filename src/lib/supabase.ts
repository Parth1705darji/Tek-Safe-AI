import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Anon client — only used for truly public operations (e.g. KB reads)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Creates a per-session Supabase client that injects Clerk's JWT on every
 * request, satisfying the RLS policies that check request.jwt.claims->>'sub'.
 */
export function createAuthenticatedClient(
  getToken: () => Promise<string | null>
) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (url: RequestInfo | URL, options: RequestInit = {}) => {
        const token = await getToken();
        const headers = new Headers(options.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(url, { ...options, headers });
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
