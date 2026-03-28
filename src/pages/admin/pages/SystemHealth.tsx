import { useState, useEffect, useCallback } from 'react';
import { useAdminToken } from '../../../hooks/useAdminToken';
import { CheckCircle2, XCircle, RefreshCw, Database, Key, Server, ShieldAlert } from 'lucide-react';

interface EnvStatus {
  hasSupabaseUrl: boolean;
  hasServiceRole: boolean;
  hasDeepSeek: boolean;
  hasOpenAI: boolean;
  hasHIBP: boolean;
  hasVirusTotal: boolean;
  hasAbuseIPDB: boolean;
  hasChatwoot: boolean;
  hasAdminEmail: boolean;
  hasClerkSecret: boolean;
  hasResend: boolean;
}

interface RecentError {
  event_type: string;
  event_data: Record<string, string>;
  created_at: string;
}

interface DBStats {
  tables: {
    users: number;
    conversations: number;
    messages: number;
    kb_documents: number;
    kb_embeddings: number;
    analytics_events: number;
  };
}

const StatusRow = ({ label, ok, optional }: { label: string; ok: boolean; optional?: boolean }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
    <div>
      <span className="text-sm text-gray-300">{label}</span>
      {optional && <span className="ml-1.5 text-xs text-gray-600">(optional)</span>}
    </div>
    {ok ? (
      <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
        <CheckCircle2 className="h-4 w-4" /> Configured
      </span>
    ) : (
      <span className={`flex items-center gap-1.5 text-xs font-medium ${optional ? 'text-gray-500' : 'text-red-400'}`}>
        <XCircle className="h-4 w-4" /> Missing
      </span>
    )}
  </div>
);

const GUARDRAIL_LABELS: Record<string, string> = {
  pii: 'PII Detected',
  off_topic: 'Off-Topic',
  unsafe: 'Unsafe Content',
};

const SystemHealth = () => {
  const adminFetch = useAdminToken();

  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [recentErrors, setRecentErrors] = useState<RecentError[]>([]);
  const [dbStats, setDbStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [envRes, dbRes] = await Promise.all([
        adminFetch('/api/admin/stats?include=env'),
        adminFetch('/api/admin/stats?include=db'),
      ]);

      if (envRes.ok) {
        const data = await envRes.json();
        setEnv(data.env ?? null);
        setRecentErrors(data.recentErrors ?? []);
      }
      if (dbRes.ok) {
        setDbStats(await dbRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allOk = env
    ? env.hasSupabaseUrl && env.hasServiceRole && env.hasDeepSeek && env.hasAdminEmail && env.hasClerkSecret
    : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">System Health</h1>
          <p className="text-sm text-gray-400">API keys, database, and guardrail activity</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Overall Status Banner */}
      <div className={`rounded-2xl border p-4 ${
        loading ? 'border-gray-700 bg-gray-900'
        : allOk ? 'border-green-500/30 bg-green-500/10'
        : 'border-yellow-500/30 bg-yellow-500/10'
      }`}>
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-[#00D4AA]" />
          ) : allOk ? (
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          ) : (
            <XCircle className="h-5 w-5 text-yellow-400" />
          )}
          <div>
            <p className={`text-sm font-medium ${
              loading ? 'text-gray-300' : allOk ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {loading ? 'Checking system status…'
               : allOk ? 'All Core Systems Operational'
               : 'Some required keys are missing'}
            </p>
            {!loading && !allOk && (
              <p className="text-xs text-gray-400">Check the API Keys section below</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* API Keys */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Key className="h-4 w-4 text-[#00D4AA]" />
            <h2 className="font-semibold text-white">API Keys</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-9 animate-pulse rounded bg-gray-800" />)}
            </div>
          ) : !env ? (
            <p className="text-sm text-gray-500">Could not load env status.</p>
          ) : (
            <>
              <StatusRow label="Supabase URL" ok={env.hasSupabaseUrl} />
              <StatusRow label="Supabase Service Role" ok={env.hasServiceRole} />
              <StatusRow label="DeepSeek API" ok={env.hasDeepSeek} />
              <StatusRow label="Clerk Secret Key" ok={env.hasClerkSecret} />
              <StatusRow label="Admin Email" ok={env.hasAdminEmail} />
              <StatusRow label="OpenAI API (Embeddings)" ok={env.hasOpenAI} optional />
              <StatusRow label="HaveIBeenPwned API" ok={env.hasHIBP} optional />
              <StatusRow label="VirusTotal API" ok={env.hasVirusTotal} optional />
              <StatusRow label="AbuseIPDB API" ok={env.hasAbuseIPDB} optional />
              <StatusRow label="Chatwoot" ok={env.hasChatwoot} optional />
              <StatusRow label="Resend (Email)" ok={env.hasResend} optional />
            </>
          )}
        </div>

        {/* Database Stats */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-[#00D4AA]" />
            <h2 className="font-semibold text-white">Database Tables</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 animate-pulse rounded bg-gray-800" />)}
            </div>
          ) : !dbStats ? (
            <p className="text-sm text-gray-500">Could not load database stats</p>
          ) : (
            Object.entries(dbStats.tables).map(([table, count]) => (
              <div key={table} className="flex items-center justify-between border-b border-gray-800 py-2.5 last:border-0">
                <span className="text-sm font-mono text-gray-300">{table}</span>
                <span className="text-sm font-semibold text-white">{count.toLocaleString()} rows</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Guardrail Events */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#00D4AA]" />
          <h2 className="font-semibold text-white">Recent Guardrail Blocks</h2>
          <span className="ml-auto text-xs text-gray-500">Last 20 events</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded bg-gray-800" />)}
          </div>
        ) : recentErrors.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            No guardrail blocks recorded yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="pb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Type</th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Details</th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wide text-gray-500 text-right">Time (IST)</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((e, i) => {
                  const blockType = e.event_data?.type ?? 'unknown';
                  const ist = new Date(e.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                  return (
                    <tr key={i} className="border-b border-gray-800/50 last:border-0">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          blockType === 'pii' ? 'bg-red-500/20 text-red-400'
                          : blockType === 'off_topic' ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {GUARDRAIL_LABELS[blockType] ?? blockType}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-400 text-xs font-mono">
                        {e.event_data?.conversation_id
                          ? `conv: ${String(e.event_data.conversation_id).slice(0, 8)}…`
                          : '—'}
                      </td>
                      <td className="py-2 text-right text-xs text-gray-500">{ist}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Runtime note */}
      <div className="rounded-2xl border border-gray-700/50 bg-gray-900/50 p-4">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-gray-600" />
          <p className="text-sm text-gray-500">
            For serverless function logs, check{' '}
            <span className="font-mono text-gray-400">Vercel Dashboard → Functions → Logs</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;
