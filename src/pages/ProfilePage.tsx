import { useEffect, useState } from 'react';
import { useUser, UserProfile } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import { DAILY_LIMITS } from '../lib/utils';
import type { User } from '../types';
import { Shield, Mail, Star, MessageSquare, Settings } from 'lucide-react';

const ProfilePage = () => {
  const { user, isLoaded } = useUser();
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [showManageAccount, setShowManageAccount] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const fetchUser = async () => {
      const result = await supabase
        .from('users')
        .select('*')
        .eq('clerk_id', user.id)
        .single() as { data: User | null; error: unknown };
      if (result.data) setDbUser(result.data);
    };
    fetchUser();
  }, [isLoaded, user]);

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg">
        <div className="w-8 h-8 border-2 border-primary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const tier = dbUser?.tier ?? 'free';
  const dailyLimit = DAILY_LIMITS[tier];
  const messageCount = dbUser?.daily_message_count ?? 0;
  const remaining = dailyLimit === Infinity ? Infinity : Math.max(0, dailyLimit - messageCount);

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src={user.imageUrl}
            alt={user.fullName ?? 'User'}
            className="h-16 w-16 rounded-full ring-2 ring-primary/20"
          />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {user.fullName ?? user.username ?? 'User'}
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                tier === 'premium'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              <Star className="h-3 w-3" />
              {tier === 'premium' ? 'Premium' : 'Free Plan'}
            </span>
          </div>
        </div>

        {/* Info cards */}
        <div className="space-y-3 mb-8">
          {/* Email */}
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <Mail className="h-4 w-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user.primaryEmailAddress?.emailAddress ?? '—'}
              </p>
            </div>
          </div>

          {/* Account tier */}
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <Shield className="h-4 w-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Account Tier</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{tier}</p>
            </div>
          </div>

          {/* Usage */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="h-4 w-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Messages Today</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {messageCount}
                  {dailyLimit !== Infinity && (
                    <span className="text-gray-400 dark:text-gray-500"> / {dailyLimit}</span>
                  )}
                  {dailyLimit === Infinity && (
                    <span className="ml-1 text-xs text-accent">Unlimited</span>
                  )}
                </p>
              </div>
            </div>

            {dailyLimit !== Infinity && (
              <div className="w-full rounded-full bg-gray-100 dark:bg-gray-800 h-2">
                <div
                  className="h-2 rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, (messageCount / dailyLimit) * 100)}%` }}
                />
              </div>
            )}

            {dailyLimit !== Infinity && remaining === 0 && (
              <p className="mt-2 text-xs text-red-500">
                Daily limit reached. Resets at midnight.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowManageAccount(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Manage Account
          </button>
        </div>

        {/* Clerk UserProfile modal */}
        {showManageAccount && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowManageAccount(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <UserProfile />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
