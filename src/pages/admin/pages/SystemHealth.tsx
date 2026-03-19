import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/react';
import { CheckCircle2, XCircle, RefreshCw, Database, Key, Server } from 'lucide-react';

interface EnvStatus {
  hasSupabaseUrl: boolean;
  hasServiceRole: boolean;
  hasDeepSeek: boolean;
  hasOpenAI: boolean;
  hasHIBP: boolean;
  hasVirusTotal: boolean;
  hasAbuseIPDB: boolean;
  hasRazorpay: boolean;
  hasChatwoot: boolean;
  hasAdminEmail: boolean;
  hasClerkSecret: boolean;
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

const StatusRow = ({ label, ok }: { label: string; ok: boolean }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
    <span className="text-sm text-gray-300">{label}</span>
    {ok ? (
      <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
        <CheckCircle2 className="h-4 w-4" /> Configured
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
        <XCircle className="h-4 w-4" /> Missing
      </span>
    )}
  </div>
);

const SystemHealth = () => {
  const { user } = useUser();
  const adminEmail = user?.primaryEmailAddress?.emailAddress ?? '';

  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [dbStats, setDbStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pingRes, dbRes] = await Promise.all([
        fetch('/api/ping'),
        fetch('/api/admin/db-stats', {
          headers: { 'x-admin-email': adminEmail },
        }),
      ]);

      if (pingRes.ok) {
        const data = await pingRes.json();
        setEnv(data.env ?? null);
      }
      if (dbRes.ok) {
        setDbStats(await dbRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [adminEmail]);

  useEffect(() => {
    if (adminEmail) fetchData();
  }, [adminEmail, fetchData]);

  const allOk = env
    ? env.hasSupabaseUrl && env.hasServiceRole && env.hasDeepSeek && env.hasAdminEmail
    : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">System Health</h1>
          <p className="text-sm text-gray-400">API keys, database, and infrastructure status</p>
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
              {loading ? 'Checking system status...'
               : allOk ? 'All Systems Operational'
               : 'Some keys are missing'}
            </p>
            {!loading && !allOk && (
              <p className="text-xs text-gray-400">Check the list below for missing configuration</p>
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
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 animate-pulse rounded bg-gray-800" />)}
            </div>
          ) : !env ? (
            <p className="text-sm text-gray-500">Could not load env status. Check /api/ping endpoint.</p>
          ) : (
            <>
              <StatusRow label="Supabase URL" ok={env.hasSupabaseUrl} />
              <StatusRow label="Supabase Service Role" ok={env.hasServiceRole} />
              <StatusRow label="DeepSeek API" ok={env.hasDeepSeek} />
              <StatusRow label="OpenAI API (Embeddings)" ok={env.hasOpenAI} />
              <StatusRow label="HaveIBeenPwned API" ok={env.hasHIBP} />
              <StatusRow label="VirusTotal API" ok={env.hasVirusTotal} />
              <StatusRow label="AbuseIPDB API" ok={env.hasAbuseIPDB} />
              <StatusRow label="Razorpay" ok={env.hasRazorpay} />
              <StatusRow label="Chatwoot" ok={env.hasChatwoot} />
              <StatusRow label="Admin Email" ok={env.hasAdminEmail} />
              <StatusRow label="Clerk Secret Key" ok={env.hasClerkSecret} />
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

      {/* Runtime Logs Placeholder */}
      <div className="rounded-2xl border border-gray-700/50 bg-gray-900/50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Server className="h-4 w-4 text-gray-600" />
          <h2 className="font-semibold text-gray-400">Runtime Logs</h2>
        </div>
        <p className="text-sm text-gray-500">
          Error logging coming soon. For now, check{' '}
          <span className="font-mono text-gray-400">Vercel Dashboard → Functions → Logs</span>{' '}
          for runtime errors.
        </p>
      </div>
    </div>
  );
};

export default SystemHealth;
