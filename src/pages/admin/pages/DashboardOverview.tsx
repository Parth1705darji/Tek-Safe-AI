import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Shield, ThumbsUp, Database, Activity, RefreshCw, UserCheck, Megaphone, ClipboardList } from 'lucide-react';
import { useAdminStats } from '../../../hooks/useAdminStats';
import { StatCard } from '../components/StatCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

const DashboardOverview = () => {
  const navigate = useNavigate();
  const { stats, loading, error, refetch } = useAdminStats();

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-gray-400">{error}</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 rounded-xl bg-[#00D4AA]/10 px-4 py-2 text-sm text-[#00D4AA] hover:bg-[#00D4AA]/20"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const feedbackTotal = (stats?.feedback.up ?? 0) + (stats?.feedback.down ?? 0);
  const feedbackPct = feedbackTotal > 0
    ? Math.round((stats!.feedback.up / feedbackTotal) * 100)
    : 0;

  const feedbackColor = feedbackPct >= 70
    ? 'text-green-400'
    : feedbackPct >= 50 ? 'text-yellow-400' : 'text-red-400';

  const toolsTotal = Object.values(stats?.tools ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-sm text-gray-400">Real-time stats for Tek-Safe AI</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <LoadingSkeleton variant="card" count={6} />
        ) : (
          <>
            <StatCard
              title="Total Users"
              value={stats?.users.total ?? 0}
              trend={`+${stats?.users.today ?? 0} today · +${stats?.users.thisWeek ?? 0} this week`}
              icon={Users}
            />
            <StatCard
              title="Active Users (24h)"
              value={stats?.users.active24h ?? 0}
              trend={`${stats?.users.active7d ?? 0} active this week`}
              icon={UserCheck}
              iconColor="text-[#00D4AA]"
            />
            <StatCard
              title="AI Responses"
              value={stats?.messages.total ?? 0}
              trend={`+${stats?.messages.today ?? 0} today · +${stats?.messages.thisWeek ?? 0} this week`}
              icon={MessageSquare}
              iconColor="text-blue-400"
            />
            <StatCard
              title="Feedback Score"
              value={`${feedbackPct}%`}
              subtitle={`${stats?.feedback.up ?? 0} thumbs up · ${stats?.feedback.down ?? 0} thumbs down`}
              icon={ThumbsUp}
              iconColor={feedbackColor}
            />
            <StatCard
              title="Knowledge Base"
              value={stats?.kbDocuments.length ?? 0}
              subtitle="Articles in knowledge base"
              icon={Database}
              iconColor="text-orange-400"
            />
            <StatCard
              title="Suspended Users"
              value={stats?.users.suspended ?? 0}
              subtitle={stats?.users.suspended ? 'Accounts suspended' : 'No suspended accounts'}
              icon={Activity}
              iconColor={stats?.users.suspended ? 'text-red-400' : 'text-green-400'}
            />
          </>
        )}
      </div>

      {/* Recent Users Table */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h2 className="font-semibold text-white">Recent Users</h2>
          <button
            onClick={() => navigate('/admin/users')}
            className="text-xs text-[#00D4AA] hover:underline"
          >
            View All →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">User</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Plan</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Messages</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Role</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingSkeleton variant="table-row" count={5} />
              ) : stats?.recentUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-500">No users yet</td>
                </tr>
              ) : (
                stats?.recentUsers.slice(0, 5).map(u => (
                  <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-white">{u.display_name ?? 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.tier === 'pro' ? 'bg-[#00D4AA]/20 text-[#00D4AA]'
                        : u.tier === 'team' ? 'bg-purple-500/20 text-purple-400'
                        : u.tier === 'premium' ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-gray-700 text-gray-300'
                      }`}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-300">{u.daily_message_count}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300'
                      }`}>
                        {u.role ?? 'user'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tool usage breakdown */}
      {!loading && toolsTotal > 0 && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-purple-400" />
            <h2 className="font-semibold text-white">Security Tool Usage</h2>
            <span className="ml-auto text-xs text-gray-500">{toolsTotal} total uses</span>
          </div>
          <div className="space-y-3">
            {Object.entries(stats?.tools ?? {})
              .sort(([, a], [, b]) => b - a)
              .map(([tool, count]) => {
                const pct = Math.round((count / toolsTotal) * 100);
                return (
                  <div key={tool}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300 capitalize">{tool.replace(/_/g, ' ')}</span>
                      <span className="text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-800">
                      <div className="h-1.5 rounded-full bg-purple-500/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => navigate('/admin/kb')}
          className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left hover:border-[#00D4AA]/50 transition-colors"
        >
          <Database className="h-5 w-5 text-orange-400 mb-2" />
          <p className="font-medium text-white">Add KB Article</p>
          <p className="text-sm text-gray-400">Add to knowledge base</p>
        </button>
        <button
          onClick={() => navigate('/admin/users')}
          className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left hover:border-[#00D4AA]/50 transition-colors"
        >
          <Users className="h-5 w-5 text-blue-400 mb-2" />
          <p className="font-medium text-white">Manage Users</p>
          <p className="text-sm text-gray-400">View, search and update users</p>
        </button>
        <button
          onClick={() => navigate('/admin/broadcast')}
          className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left hover:border-[#00D4AA]/50 transition-colors"
        >
          <Megaphone className="h-5 w-5 text-[#00D4AA] mb-2" />
          <p className="font-medium text-white">Broadcast</p>
          <p className="text-sm text-gray-400">Post announcements to users</p>
        </button>
        <button
          onClick={() => navigate('/admin/audit-log')}
          className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left hover:border-[#00D4AA]/50 transition-colors"
        >
          <ClipboardList className="h-5 w-5 text-yellow-400 mb-2" />
          <p className="font-medium text-white">Audit Log</p>
          <p className="text-sm text-gray-400">Review admin actions</p>
        </button>
      </div>
    </div>
  );
};

export default DashboardOverview;
