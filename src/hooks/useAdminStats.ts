import { useState, useEffect, useCallback } from 'react';
import { useAdminToken } from './useAdminToken';

export interface AdminStats {
  users: { total: number; today: number; thisWeek: number };
  messages: { total: number; today: number; thisWeek: number };
  tools: Record<string, number>;
  feedback: { up: number; down: number };
  recentUsers: Array<{
    id: string;
    clerk_id: string;
    email: string;
    display_name: string | null;
    tier: string;
    role: string;
    daily_message_count: number;
    created_at: string;
  }>;
  kbDocuments: Array<{
    id: string;
    title: string;
    category: string;
    subcategory: string;
    tags: string[];
    created_at: string;
  }>;
  timeSeries?: {
    messages: Array<{ date: string; count: number }>;
    users: Array<{ date: string; count: number }>;
  };
}

export function useAdminStats() {
  const adminFetch = useAdminToken();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/stats');
      if (!res.ok) {
        setError('Failed to load stats');
        return;
      }
      setStats(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
