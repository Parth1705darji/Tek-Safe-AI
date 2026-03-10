import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useSupabase } from '../../hooks/useSupabase';
import type { User } from '../../types';

interface AuthWrapperProps {
  children: React.ReactNode;
}

/**
 * Ensures the authenticated Clerk user exists in the Supabase `users` table.
 * Uses the authenticated Supabase client so RLS policies are satisfied.
 */
const AuthWrapper = ({ children }: AuthWrapperProps) => {
  const { user, isLoaded } = useUser();
  const supabase = useSupabase();
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    if (!isLoaded || !user) {
      setSyncing(false);
      return;
    }

    const syncUser = async () => {
      setSyncing(true);

      // Check if user already exists in Supabase
      const { data: existing } = (await supabase
        .from('users')
        .select('*')
        .eq('clerk_id', user.id)
        .single()) as { data: User | null; error: unknown };

      if (existing) {
        setSyncing(false);
        return;
      }

      // Webhook may still be processing — wait 1.5s and retry once
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const { data: retried } = (await supabase
        .from('users')
        .select('*')
        .eq('clerk_id', user.id)
        .single()) as { data: User | null; error: unknown };

      if (retried) {
        setSyncing(false);
        return;
      }

      // Fallback: create the user record client-side
      await supabase.from('users').insert({
        clerk_id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? '',
        display_name: user.fullName ?? user.username ?? null,
        avatar_url: user.imageUrl ?? null,
      });

      setSyncing(false);
    };

    syncUser();
  }, [isLoaded, user, supabase]);

  if (syncing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthWrapper;
