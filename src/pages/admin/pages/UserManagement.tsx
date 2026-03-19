import { useState, Fragment } from 'react';
import { useUser } from '@clerk/react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { showToast } from '../../../components/common/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useAdminUsers, type AdminUser } from '../../../hooks/useAdminUsers';

const UserManagement = () => {
  const { user } = useUser();
  const adminEmail = user?.primaryEmailAddress?.emailAddress ?? '';

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = useAdminUsers({
    search,
    tier: tierFilter,
    role: roleFilter,
    page,
  });

  const [roleConfirm, setRoleConfirm] = useState<{ userId: string; name: string; newRole: 'user' | 'admin' } | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  const handleRoleChange = async () => {
    if (!roleConfirm) return;
    setUpdatingRole(true);
    try {
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail,
        },
        body: JSON.stringify({
          targetUserId: roleConfirm.userId,
          role: roleConfirm.newRole,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to update role');
      }
      showToast(`Role updated. User must re-login to see changes.`);
      setRoleConfirm(null);
      refetch();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setUpdatingRole(false);
    }
  };

  const getInitials = (u: AdminUser) => {
    if (u.display_name) return u.display_name[0].toUpperCase();
    return u.email[0].toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">User Management</h1>
        <p className="text-sm text-gray-400">
          {data ? `${data.total} total users` : 'Loading...'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email..."
            className="w-full rounded-xl border border-gray-700 bg-gray-800 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:border-[#00D4AA] focus:outline-none"
          />
        </div>
        <select
          value={tierFilter}
          onChange={e => { setTierFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-[#00D4AA] focus:outline-none"
        >
          <option value="">All Tiers</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="team">Team</option>
          <option value="premium">Premium</option>
        </select>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-[#00D4AA] focus:outline-none"
        >
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">User</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Tier</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Role</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Messages</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Joined</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingSkeleton variant="table-row" count={8} />
              ) : !data?.users.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    {search || tierFilter || roleFilter ? 'No users match your filters' : 'No users yet'}
                  </td>
                </tr>
              ) : (
                data.users.map(u => (
                  <Fragment key={u.id}>
                    <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-white">
                              {getInitials(u)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-white">{u.display_name ?? '—'}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.tier === 'pro' ? 'bg-[#00D4AA]/20 text-[#00D4AA]'
                          : u.tier === 'team' ? 'bg-purple-500/20 text-purple-400'
                          : u.tier === 'premium' ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-700 text-gray-300'
                        }`}>{u.tier}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300'
                        }`}>{u.role ?? 'user'}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-300">{u.daily_message_count}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3">
                        {u.role === 'admin' ? (
                          <button
                            onClick={() => setRoleConfirm({ userId: u.clerk_id, name: u.display_name ?? u.email, newRole: 'user' })}
                            className="rounded-lg border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:border-red-500/50 hover:text-red-400 transition-colors"
                          >
                            Make User
                          </button>
                        ) : (
                          <button
                            onClick={() => setRoleConfirm({ userId: u.clerk_id, name: u.display_name ?? u.email, newRole: 'admin' })}
                            className="rounded-lg border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:border-[#00D4AA]/50 hover:text-[#00D4AA] transition-colors"
                          >
                            Make Admin
                          </button>
                        )}
                      </td>
                    </tr>
                    {roleConfirm?.userId === u.clerk_id && (
                      <tr className="border-b border-gray-800/50 bg-gray-800/20">
                        <td colSpan={6} className="px-5 py-2">
                          <ConfirmModal
                            message={`Change ${roleConfirm.name}'s role to ${roleConfirm.newRole}? They must re-login to see changes.`}
                            onConfirm={handleRoleChange}
                            onCancel={() => setRoleConfirm(null)}
                            isLoading={updatingRole}
                            variant="warning"
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-800 px-5 py-3">
            <p className="text-xs text-gray-400">
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data.total)} of {data.total} users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-700 p-1.5 text-gray-400 hover:text-white disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-400">{page} / {data.totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="rounded-lg border border-gray-700 p-1.5 text-gray-400 hover:text-white disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
