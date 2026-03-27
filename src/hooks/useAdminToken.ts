import { useAuth } from '@clerk/react';
import { useCallback } from 'react';

/**
 * Returns an `adminFetch` helper that automatically attaches a valid Clerk
 * Bearer token to every request — replacing the old x-admin-email header.
 *
 * Usage:
 *   const adminFetch = useAdminToken();
 *   const res = await adminFetch('/api/admin/stats');
 */
export function useAdminToken() {
  const { getToken } = useAuth();

  return useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const token = await getToken();
      return fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${token ?? ''}`,
        },
      });
    },
    [getToken]
  );
}
