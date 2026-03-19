import { useUser } from '@clerk/react';

export type UserRole = 'user' | 'admin';

export function useRole(): UserRole {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as UserRole | undefined;
  return role ?? 'user';
}

export function useIsAdmin(): boolean {
  return useRole() === 'admin';
}
