import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/react';

export interface AdminUser {
  id: string;
  clerk_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: string;
  role: string;
  daily_message_count: number;
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
  const { user } = useUser();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!user) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: filters.page.toString(),
      ...(filters.search && { search: filters.search }),
      ...(filters.tier && { tier: filters.tier }),
      ...(filters.role && { role: filters.role }),
    });

    try {
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { 'x-admin-email': email },
      });

      if (!res.ok) {
        setError('Failed to load users');
        return;
      }

      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user, filters.search, filters.tier, filters.role, filters.page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return { data, loading, error, refetch: fetchUsers };
}
