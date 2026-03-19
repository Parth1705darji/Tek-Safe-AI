import { useAdminStats } from '../../../hooks/useAdminStats';
import { BarChart3, TrendingUp, RefreshCw } from 'lucide-react';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { StatCard } from '../components/StatCard';

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
  const feedbackTotal = (stats?.feedback.up ?? 0) + (stats?.feedback.down ?? 0);

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

      <div className="rounded-2xl border border-gray-700/50 bg-gray-900/50 p-5 text-center">
        <BarChart3 className="mx-auto mb-2 h-8 w-8 text-gray-600" />
        <p className="text-sm font-medium text-gray-400">Time-Series Charts</p>
        <p className="mt-1 text-xs text-gray-600">
          Daily message trends and user growth charts will appear here once analytics_events table has 7+ days of data.
        </p>
      </div>
    </div>
  );
};

export default AnalyticsPage;
