import { useSession } from '@clerk/react';
import { useMemo } from 'react';
import { createAuthenticatedClient } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

/**
 * Returns a Supabase client that attaches the current Clerk session token
 * as the Authorization header on every request, satisfying RLS policies.
 *
 * Requires a "supabase" JWT template to be configured in Clerk Dashboard
 * (Configure → JWT Templates → New → Supabase).
 */
export function useSupabase(): SupabaseClient<Database> {
  const { session } = useSession();

  return useMemo(
    () =>
      createAuthenticatedClient(() =>
        session
          ? session.getToken({ template: 'supabase' })
          : Promise.resolve(null)
      ),
    [session]
  );
}
