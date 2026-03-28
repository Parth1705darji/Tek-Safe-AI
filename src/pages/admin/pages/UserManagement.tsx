import { useState, Fragment, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ChevronLeft, ChevronRight, Download,
  ShieldOff, ShieldCheck, RefreshCw, Trash2, ChevronDown,
} from 'lucide-react';
import { showToast } from '../../../components/common/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useAdminUsers, type AdminUser } from '../../../hooks/useAdminUsers';
import { useAdminToken } from '../../../hooks/useAdminToken';

type ActionKey = 'role' | 'tier' | 'suspend' | 'unsuspend' | 'reset_quota' | 'delete';

interface PendingAction {
  key: ActionKey;
  user: AdminUser;
  extra?: string;
}

interface MenuState {
  userId: string;
  user: AdminUser;
  top: number;
  right: number;
}

const TIER_OPTIONS = ['free', 'pro', 'team', 'premium'] as const;

const UserManagement = () => {
  const adminFetch = useAdminToken();

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = useAdminUsers({
    search, tier: tierFilter, role: roleFilter, page,
  });

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [acting, setActing] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click or scroll
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  const openMenu = (u: AdminUser, btn: HTMLButtonElement) => {
    const rect = btn.getBoundingClientRect();
    setMenu({
      userId: u.id,
      user: u,
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  };

  // ── Role change ────────────────────────────────────────────────────────────
  const handleRoleChange = useCallback(async (u: AdminUser, newRole: 'user' | 'admin') => {
    setActing(true);
    try {
      const res = await adminFetch('/api/admin/user-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_role', clerkId: u.clerk_id, role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to update role');
      }
      showToast('Role updated. User must re-login to see changes.');
      refetch();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setActing(false);
      setPending(null);
    }
  }, [adminFetch, refetch]);

  // ── Generic user-actions endpoint ─────────────────────────────────────────
  const callUserAction = useCallback(async (action: string, clerkId: string, extra?: Record<string, string>) => {
    const res = await adminFetch('/api/admin/user-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, clerkId, ...extra }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Action failed');
    }
  }, [adminFetch]);

  const handleConfirm = async () => {
    if (!pending) return;
    setActing(true);
    try {
      const { key, user: u, extra } = pending;
      if (key === 'role') {
        const newRole = u.role === 'admin' ? 'user' : 'admin';
        await handleRoleChange(u, newRole);
        return;
      }
      if (key === 'tier' && extra) {
        await callUserAction('set_tier', u.clerk_id, { tier: extra });
        showToast(`Tier updated to ${extra}`);
      } else if (key === 'suspend') {
        await callUserAction('suspend', u.clerk_id);
        showToast('User suspended');
      } else if (key === 'unsuspend') {
        await callUserAction('unsuspend', u.clerk_id);
        showToast('User unsuspended');
      } else if (key === 'reset_quota') {
        await callUserAction('reset_quota', u.clerk_id);
        showToast('Quota reset');
      } else if (key === 'delete') {
        await callUserAction('delete_user', u.clerk_id);
        showToast('User deleted');
      }
      refetch();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setActing(false);
      setPending(null);
    }
  };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const users = data?.users ?? [];
    const header = ['Email', 'Name', 'Tier', 'Role', 'Messages', 'Suspended', 'Joined'];
    const rows = users.map(u => [
      u.email, u.display_name ?? '', u.tier, u.role,
      u.daily_message_count, u.is_suspended ? 'Yes' : 'No',
      new Date(u.created_at).toLocaleDateString('en-GB'),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getInitials = (u: AdminUser) =>
    u.display_name ? u.display_name[0].toUpperCase() : u.email[0].toUpperCase();

  const confirmMessage = (p: PendingAction): string => {
    const name = p.user.display_name ?? p.user.email;
    switch (p.key) {
      case 'role': return `Change ${name}'s role to ${p.user.role === 'admin' ? 'user' : 'admin'}? They must re-login to see changes.`;
      case 'tier': return `Change ${name}'s tier to ${p.extra}?`;
      case 'suspend': return `Suspend ${name}? They won't be able to use the chat.`;
      case 'unsuspend': return `Unsuspend ${name}? They'll regain access to the chat.`;
      case 'reset_quota': return `Reset ${name}'s daily message quota to 0?`;
      case 'delete': return `Permanently delete ${name} and all their data? This cannot be undone.`;
    }
  };

  // Portal dropdown — renders outside overflow containers so it's never clipped
  const ActionMenu = menu && createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: menu.top, right: menu.right, zIndex: 9999 }}
      className="w-48 rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-2xl"
      onMouseDown={e => e.stopPropagation()}
    >
      <button
        onClick={() => { setPending({ key: 'role', user: menu.user }); setMenu(null); }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white"
      >
        {menu.user.role === 'admin' ? 'Make User' : 'Make Admin'}
      </button>

      <div className="border-t border-gray-800 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-600">
        Set Tier
      </div>
      {TIER_OPTIONS.filter(t => t !== menu.user.tier).map(t => (
        <button
          key={t}
          onClick={() => { setPending({ key: 'tier', user: menu.user, extra: t }); setMenu(null); }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white capitalize"
        >
          {t}
        </button>
      ))}

      <div className="border-t border-gray-800 mt-1 pt-1">
        {menu.user.is_suspended ? (
          <button
            onClick={() => { setPending({ key: 'unsuspend', user: menu.user }); setMenu(null); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-green-400 hover:bg-gray-800"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Unsuspend
          </button>
        ) : (
          <button
            onClick={() => { setPending({ key: 'suspend', user: menu.user }); setMenu(null); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-yellow-400 hover:bg-gray-800"
          >
            <ShieldOff className="h-3.5 w-3.5" /> Suspend
          </button>
        )}
        <button
          onClick={() => { setPending({ key: 'reset_quota', user: menu.user }); setMenu(null); }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reset Quota
        </button>
        <button
          onClick={() => { setPending({ key: 'delete', user: menu.user }); setMenu(null); }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete User
        </button>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="flex flex-col h-full space-y-5">
      {ActionMenu}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">User Management</h1>
          <p className="text-sm text-gray-400">
            {data ? `${data.total} total users` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
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
          {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
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
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* Table */}
      <div className="flex-1 rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">User</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Tier</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Role</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Msgs</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Joined</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingSkeleton variant="table-row" count={8} />
              ) : !data?.users.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-gray-500">
                    {search || tierFilter || roleFilter ? 'No users match your filters' : 'No users yet'}
                  </td>
                </tr>
              ) : (
                data.users.map(u => (
                  <Fragment key={u.id}>
                    <tr className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${u.is_suspended ? 'opacity-60' : ''}`}>
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
                      <td className="px-5 py-3">
                        {u.is_suspended ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                            <ShieldOff className="h-3 w-3" /> Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                            <ShieldCheck className="h-3 w-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-300">{u.daily_message_count}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={e => openMenu(u, e.currentTarget)}
                          className="flex items-center gap-1 rounded-lg border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
                        >
                          Actions <ChevronDown className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>

                    {pending?.user.id === u.id && (
                      <tr className="border-b border-gray-800/50 bg-gray-800/20">
                        <td colSpan={7} className="px-5 py-2">
                          <ConfirmModal
                            message={confirmMessage(pending)}
                            onConfirm={handleConfirm}
                            onCancel={() => setPending(null)}
                            isLoading={acting}
                            variant={pending.key === 'delete' ? 'danger' : 'warning'}
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
