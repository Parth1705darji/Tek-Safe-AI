import { useState, useEffect, useCallback } from 'react';
import { useAdminToken } from './useAdminToken';

export interface AdminUser {
  id: string;
  clerk_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: string;
  role: string;
  daily_message_count: number;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
}

interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

export function useAdminUsers(filters: {
  search: string;
  tier: string;
  role: string;
  page: number;
}) {
  const adminFetch = useAdminToken();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: filters.page.toString(),
      ...(filters.search && { search: filters.search }),
      ...(filters.tier && { tier: filters.tier }),
      ...(filters.role && { role: filters.role }),
    });

    try {
      const res = await adminFetch(`/api/admin/users?${params}`);
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.json()).error ?? ''; } catch { /* ignore */ }
        setError(`Failed to load users (${res.status}${detail ? ': ' + detail : ''})`);
        return;
      }
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminFetch, filters.search, filters.tier, filters.role, filters.page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return { data, loading, error, refetch: fetchUsers };
}
