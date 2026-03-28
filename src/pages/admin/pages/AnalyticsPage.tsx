import { useAdminStats } from '../../../hooks/useAdminStats';
import { BarChart3, TrendingUp, RefreshCw, Users, ShieldAlert, Zap } from 'lucide-react';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { StatCard } from '../components/StatCard';
import MiniLineChart from '../components/MiniLineChart';

const AnalyticsPage = () => {
  const { stats, loading, error, refetch } = useAdminStats();

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-gray-400">{error}</p>
        <button onClick={refetch} className="flex items-center gap-2 rounded-xl bg-[#00D4AA]/10 px-4 py-2 text-sm text-[#00D4AA] hover:bg-[#00D4AA]/20">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const toolEntries = Object.entries(stats?.tools ?? {});
  const totalTools = toolEntries.reduce((a, [, v]) => a + v, 0);
  const skillEntries = Object.entries(stats?.skillUsage ?? {}).sort((a, b) => b[1] - a[1]);
  const totalSkillUses = skillEntries.reduce((a, [, v]) => a + v, 0);
  const guardrail = stats?.guardrail ?? { pii: 0, off_topic: 0, unsafe: 0, total: 0 };
  const feedbackTotal = (stats?.feedback.up ?? 0) + (stats?.feedback.down ?? 0);

  const msgSeries = stats?.timeSeries?.messages ?? [];
  const userSeries = stats?.timeSeries?.users ?? [];
  const msgTotal30 = msgSeries.reduce((s, d) => s + d.count, 0);
  const userTotal30 = userSeries.reduce((s, d) => s + d.count, 0);

  const fmtDate = (d: { date: string }) =>
    new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-400">Usage metrics and trends</p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : (
          <>
            <StatCard
              title="Total Messages"
              value={stats?.messages.total ?? 0}
              trend={`+${stats?.messages.today ?? 0} today`}
              icon={TrendingUp}
            />
            <StatCard
              title="Tool Scans Run"
              value={totalTools}
              subtitle="Security pre-flight scans"
              icon={BarChart3}
              iconColor="text-purple-400"
            />
            <StatCard
              title="Total Feedback"
              value={feedbackTotal}
              subtitle={`${stats?.feedback.up ?? 0} positive · ${stats?.feedback.down ?? 0} negative`}
              icon={TrendingUp}
              iconColor="text-green-400"
            />
          </>
        )}
      </div>

      {/* Time-series charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-white">Messages (30 days)</h2>
            <span className="text-sm font-semibold text-[#00D4AA]">
              {loading ? '—' : msgTotal30.toLocaleString()}
            </span>
          </div>
          <p className="mb-4 text-xs text-gray-500">AI responses generated</p>
          {loading ? (
            <div className="h-16 animate-pulse rounded-lg bg-gray-800" />
          ) : (
            <MiniLineChart data={msgSeries} color="#00D4AA" height={64} label={fmtDate} />
          )}
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-white">New Users (30 days)</h2>
            <span className="text-sm font-semibold text-purple-400">
              {loading ? '—' : userTotal30.toLocaleString()}
            </span>
          </div>
          <p className="mb-4 text-xs text-gray-500">Accounts created</p>
          {loading ? (
            <div className="h-16 animate-pulse rounded-lg bg-gray-800" />
          ) : (
            <MiniLineChart data={userSeries} color="#a855f7" height={64} label={fmtDate} />
          )}
        </div>
      </div>

      {/* Tool Usage Breakdown */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-4 font-semibold text-white">Security Tool Usage</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded bg-gray-800" />)}
          </div>
        ) : toolEntries.length === 0 ? (
          <p className="text-sm text-gray-500">No tool usage data yet</p>
        ) : (
          <div className="space-y-3">
            {toolEntries.map(([name, count]) => {
              const pct = totalTools > 0 ? Math.round((count / totalTools) * 100) : 0;
              return (
                <div key={name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-300 capitalize">{name.replace(/_/g, ' ')}</span>
                    <span className="text-gray-400">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full bg-[#00D4AA] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feedback Breakdown */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-4 font-semibold text-white">Response Feedback</h2>
        {feedbackTotal === 0 ? (
          <p className="text-sm text-gray-500">No feedback data yet</p>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-green-400">Thumbs Up</span>
                <span className="text-gray-400">{stats?.feedback.up ?? 0} ({feedbackTotal > 0 ? Math.round(((stats?.feedback.up ?? 0) / feedbackTotal) * 100) : 0}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${feedbackTotal > 0 ? Math.round(((stats?.feedback.up ?? 0) / feedbackTotal) * 100) : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-red-400">Thumbs Down</span>
                <span className="text-gray-400">{stats?.feedback.down ?? 0} ({feedbackTotal > 0 ? Math.round(((stats?.feedback.down ?? 0) / feedbackTotal) * 100) : 0}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-red-500 transition-all duration-500"
                  style={{ width: `${feedbackTotal > 0 ? Math.round(((stats?.feedback.down ?? 0) / feedbackTotal) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guardrail Events */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-orange-400" />
          <h2 className="font-semibold text-white">Guardrail Blocks</h2>
          {!loading && guardrail.total > 0 && (
            <span className="ml-auto text-sm font-semibold text-orange-400">{guardrail.total} total</span>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded bg-gray-800" />)}
          </div>
        ) : guardrail.total === 0 ? (
          <p className="text-sm text-gray-500">No guardrail blocks recorded yet</p>
        ) : (
          <div className="space-y-3">
            {[
              { key: 'pii', label: 'PII Detected', count: guardrail.pii, color: 'bg-red-500' },
              { key: 'off_topic', label: 'Off-Topic', count: guardrail.off_topic, color: 'bg-yellow-500' },
              { key: 'unsafe', label: 'Unsafe Content', count: guardrail.unsafe, color: 'bg-orange-500' },
            ].map(({ key, label, count, color }) => {
              const pct = guardrail.total > 0 ? Math.round((count / guardrail.total) * 100) : 0;
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-300">{label}</span>
                    <span className="text-gray-400">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                    <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Skill Usage */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#00D4AA]" />
          <h2 className="font-semibold text-white">Skill Usage</h2>
          {!loading && totalSkillUses > 0 && (
            <span className="ml-auto text-sm font-semibold text-[#00D4AA]">{totalSkillUses} activations</span>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded bg-gray-800" />)}
          </div>
        ) : skillEntries.length === 0 ? (
          <p className="text-sm text-gray-500">No skill usage data yet</p>
        ) : (
          <div className="space-y-3">
            {skillEntries.map(([slug, count]) => {
              const pct = totalSkillUses > 0 ? Math.round((count / totalSkillUses) * 100) : 0;
              return (
                <div key={slug}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-300 capitalize">{slug.replace(/_/g, ' ')}</span>
                    <span className="text-gray-400">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                    <div className="h-full rounded-full bg-[#00D4AA] transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* User Growth */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#00D4AA]" />
          <h2 className="font-semibold text-white">User Growth</h2>
        </div>
        {loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-gray-800" />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-gray-800 p-3 text-center">
              <p className="text-xl font-bold text-white">{stats?.users.total ?? 0}</p>
              <p className="text-xs text-gray-400">Total Users</p>
            </div>
            <div className="rounded-xl bg-gray-800 p-3 text-center">
              <p className="text-xl font-bold text-[#00D4AA]">+{stats?.users.today ?? 0}</p>
              <p className="text-xs text-gray-400">Today</p>
            </div>
            <div className="rounded-xl bg-gray-800 p-3 text-center">
              <p className="text-xl font-bold text-purple-400">+{stats?.users.thisWeek ?? 0}</p>
              <p className="text-xs text-gray-400">This Week</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
