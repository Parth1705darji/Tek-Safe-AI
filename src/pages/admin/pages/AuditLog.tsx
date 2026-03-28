import { useState, useEffect, useCallback } from 'react';
import { useAdminToken } from '../../../hooks/useAdminToken';
import { Shield, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

interface AuditEntry {
  id: string;
  admin_clerk_id: string;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  set_role: 'bg-purple-500/20 text-purple-400',
  set_tier: 'bg-blue-500/20 text-blue-400',
  suspend_user: 'bg-red-500/20 text-red-400',
  unsuspend_user: 'bg-green-500/20 text-green-400',
  reset_quota: 'bg-yellow-500/20 text-yellow-400',
  delete_user: 'bg-red-700/20 text-red-500',
  create_kb: 'bg-[#00D4AA]/20 text-[#00D4AA]',
  update_kb: 'bg-[#00D4AA]/20 text-[#00D4AA]',
  delete_kb: 'bg-orange-500/20 text-orange-400',
};

const ACTION_LABELS: Record<string, string> = {
  set_role: 'Set Role', set_tier: 'Set Tier',
  suspend_user: 'Suspend', unsuspend_user: 'Unsuspend',
  reset_quota: 'Reset Quota', delete_user: 'Delete User',
  create_kb: 'KB Create', update_kb: 'KB Update', delete_kb: 'KB Delete',
};

const ACTIONS = ['set_role', 'set_tier', 'suspend_user', 'unsuspend_user', 'reset_quota', 'delete_user', 'create_kb', 'update_kb', 'delete_kb'];

const AuditLog = () => {
  const adminFetch = useAdminToken();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: page.toString() });
    if (actionFilter) params.set('action', actionFilter);
    try {
      const res = await adminFetch(`/api/admin/audit-log?${params}`);
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.json()).error ?? ''; } catch { /* ignore */ }
        setError(`Failed to load audit log (${res.status}${detail ? ': ' + detail : ''})`);
        return;
      }
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminFetch, page, actionFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleFilter = (v: string) => { setActionFilter(v); setPage(1); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Audit Log</h1>
          <p className="text-sm text-gray-400">{total} admin actions recorded</p>
        </div>
        <button
          onClick={fetchEntries}
          className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleFilter('')}
          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${actionFilter === '' ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          All
        </button>
        {ACTIONS.map(a => (
          <button
            key={a}
            onClick={() => handleFilter(a)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${actionFilter === a ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {ACTION_LABELS[a] ?? a}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Time</th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Admin</th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Action</th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Target</th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">IP</th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingSkeleton variant="table-row" count={8} />
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Shield className="h-8 w-8 text-gray-700" />
                    <p className="text-gray-500">No audit entries yet</p>
                  </div>
                </td>
              </tr>
            ) : (
              entries.map(entry => (
                <>
                  <tr
                    key={entry.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  >
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3 text-gray-300 max-w-[160px] truncate">{entry.admin_email}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[entry.action] ?? 'bg-gray-700 text-gray-300'}`}>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs font-mono max-w-[120px] truncate">
                      {entry.target_type && <span className="text-gray-500">{entry.target_type}/</span>}
                      {entry.target_id?.slice(0, 12) ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{entry.ip_address ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {entry.payload
                        ? expanded === entry.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                        : null}
                    </td>
                  </tr>
                  {expanded === entry.id && entry.payload && (
                    <tr key={`${entry.id}-payload`} className="border-b border-gray-800/50 bg-gray-800/20">
                      <td colSpan={6} className="px-5 py-3">
                        <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono bg-gray-950 rounded-lg p-3 overflow-x-auto">
                          {JSON.stringify(entry.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 disabled:opacity-40 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 disabled:opacity-40 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
