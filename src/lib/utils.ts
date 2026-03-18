import { supabase } from './supabase';

// Daily message limits per tier
export const DAILY_LIMITS: Record<string, number> = {
  free: 20,
  pro: 500,
  premium: Infinity,
};

// Limit for unauthenticated (guest) users — stored in localStorage
export const GUEST_DAILY_LIMIT = 10;
const GUEST_STORAGE_KEY = 'teksafe_guest_usage';

interface GuestUsage {
  count: number;
  resetAt: string; // ISO date string — midnight of current day
}

function getTomorrowMidnight(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getTodayMidnight(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── Guest (unauthenticated) rate limiting ──────────────────────────────────

export function canGuestSendMessage(): { allowed: boolean; remaining: number; limit: number } {
  const raw = localStorage.getItem(GUEST_STORAGE_KEY);
  const todayMidnight = getTodayMidnight();

  let usage: GuestUsage = raw
    ? (JSON.parse(raw) as GuestUsage)
    : { count: 0, resetAt: getTomorrowMidnight() };

  // Reset if past the reset timestamp
  if (new Date(usage.resetAt) <= new Date(todayMidnight)) {
    usage = { count: 0, resetAt: getTomorrowMidnight() };
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(usage));
  }

  const remaining = Math.max(0, GUEST_DAILY_LIMIT - usage.count);
  return { allowed: remaining > 0, remaining, limit: GUEST_DAILY_LIMIT };
}

export function incrementGuestMessageCount(): void {
  const raw = localStorage.getItem(GUEST_STORAGE_KEY);
  const todayMidnight = getTodayMidnight();

  let usage: GuestUsage = raw
    ? (JSON.parse(raw) as GuestUsage)
    : { count: 0, resetAt: getTomorrowMidnight() };

  if (new Date(usage.resetAt) <= new Date(todayMidnight)) {
    usage = { count: 0, resetAt: getTomorrowMidnight() };
  }

  usage.count += 1;
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(usage));
}

// ─── Authenticated user rate limiting ───────────────────────────────────────

export async function canSendMessage(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  resetsAt: string;
}> {
  const { data: user, error } = await supabase
    .from('users')
    .select('tier, daily_message_count, daily_message_reset_at')
    .eq('id', userId)
    .single();

  if (error || !user) {
    // Fail open — allow the message if we can't check
    return { allowed: true, remaining: 1, limit: 50, resetsAt: getTomorrowMidnight() };
  }

  const tier = user.tier as string;
  const limit = DAILY_LIMITS[tier] ?? 50;

  // Premium users have no limit
  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity, limit: Infinity, resetsAt: '' };
  }

  const now = new Date();
  const resetAt = user.daily_message_reset_at ? new Date(user.daily_message_reset_at) : null;

  // If reset time is in the past or null, treat count as 0
  const effectiveCount = !resetAt || resetAt <= now ? 0 : user.daily_message_count;
  const resetsAt =
    !resetAt || resetAt <= now ? getTomorrowMidnight() : user.daily_message_reset_at!;
  const remaining = Math.max(0, limit - effectiveCount);

  return { allowed: remaining > 0, remaining, limit, resetsAt };
}

export async function incrementMessageCount(userId: string): Promise<void> {
  const { data: user } = await supabase
    .from('users')
    .select('daily_message_count, daily_message_reset_at')
    .eq('id', userId)
    .single();

  if (!user) return;

  const now = new Date();
  const resetAt = user.daily_message_reset_at ? new Date(user.daily_message_reset_at) : null;
  const isPastReset = !resetAt || resetAt <= now;

  await supabase
    .from('users')
    .update({
      daily_message_count: isPastReset ? 1 : user.daily_message_count + 1,
      daily_message_reset_at: isPastReset ? getTomorrowMidnight() : user.daily_message_reset_at,
    })
    .eq('id', userId);
}

// ─── General helpers ────────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
