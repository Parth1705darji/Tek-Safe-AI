import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { Settings, Save, RefreshCw, AlertCircle, Info } from 'lucide-react';

interface TierLimits {
  free: number;
  pro: number;
  premium: number;
  team: number;
}

const TIER_COLORS: Record<string, string> = {
  free: 'text-gray-400',
  pro: 'text-blue-400',
  team: 'text-purple-400',
  premium: 'text-[#00D4AA]',
};

const DEFAULT_LIMITS: TierLimits = { free: 20, pro: 500, team: 500, premium: -1 };

export default function SettingsPage() {
  const { getToken } = useAuth();

  const [tierLimits, setTierLimits] = useState<TierLimits>(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [sqlNote, setSqlNote] = useState(false);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, [getToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/settings', { headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (res.status === 503) { setSqlNote(true); setLoading(false); return; }
        throw new Error(d.error ?? 'Failed to load settings');
      }
      const { settings } = await res.json();
      const tierRow = (settings as Array<{ key: string; value: unknown }>).find(s => s.key === 'tier_limits');
      if (tierRow?.value && typeof tierRow.value === 'object') {
        setTierLimits({ ...DEFAULT_LIMITS, ...(tierRow.value as Partial<TierLimits>) });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          key: 'tier_limits',
          value: tierLimits,
          description: 'Daily message limits per user tier. Use -1 for unlimited.',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#00D4AA]" />
            Settings
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Configure platform behaviour</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {sqlNote && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-800 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">SQL migration required</p>
            <p className="text-yellow-400 font-mono text-xs">
              CREATE TABLE app_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, description TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
            </p>
          </div>
        </div>
      )}

      {/* Tier Limits Card */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-semibold text-white">Daily Message Limits</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Set how many messages each tier can send per day. Use <code className="bg-gray-800 px-1 rounded">-1</code> for unlimited.
        </p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-800" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.keys(DEFAULT_LIMITS) as Array<keyof TierLimits>).map(tier => (
              <div key={tier} className="flex items-center gap-4">
                <div className="w-20 shrink-0">
                  <span className={`text-sm font-semibold capitalize ${TIER_COLORS[tier]}`}>{tier}</span>
                </div>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    value={tierLimits[tier]}
                    onChange={e => setTierLimits(prev => ({ ...prev, [tier]: parseInt(e.target.value) || 0 }))}
                    min={-1}
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:border-[#00D4AA] focus:outline-none"
                  />
                  {tierLimits[tier] === -1 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#00D4AA] pointer-events-none">unlimited</span>
                  )}
                </div>
                <div className="w-28 shrink-0 text-right text-xs text-gray-500">
                  {tierLimits[tier] === -1 ? 'No limit' : `${tierLimits[tier]} msgs/day`}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
          {saved ? (
            <span className="text-sm text-[#00D4AA]">✓ Saved successfully</span>
          ) : (
            <span className="text-xs text-gray-600">Changes apply to new messages immediately</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading || sqlNote}
            className="flex items-center gap-2 rounded-xl bg-[#00D4AA] px-4 py-2 text-sm font-medium text-gray-900 hover:bg-[#00D4AA]/90 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Future settings placeholder */}
      <div className="rounded-2xl border border-gray-700/50 bg-gray-900/50 p-5">
        <p className="text-sm text-gray-500">More settings — KB categories, guardrail sensitivity, branding — coming in future sprints.</p>
      </div>
    </div>
  );
}
