import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { Settings, Save, RefreshCw, AlertCircle, Info, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';

interface TierLimits {
  free: number;
  pro: number;
  premium: number;
  team: number;
}

interface GuardrailConfig {
  pii_check: boolean;
  off_topic_check: boolean;
  unsafe_check: boolean;
  output_pii_masking: boolean;
  off_topic_strictness: 'low' | 'medium' | 'high';
}

const TIER_COLORS: Record<string, string> = {
  free: 'text-gray-400',
  pro: 'text-blue-400',
  team: 'text-purple-400',
  premium: 'text-[#00D4AA]',
};

const DEFAULT_LIMITS: TierLimits = { free: 20, pro: 500, team: 500, premium: -1 };

const DEFAULT_GUARDRAIL: GuardrailConfig = {
  pii_check: true,
  off_topic_check: true,
  unsafe_check: true,
  output_pii_masking: true,
  off_topic_strictness: 'medium',
};

const STRICTNESS_OPTIONS = [
  {
    value: 'low',
    label: 'Permissive',
    desc: 'Only block obvious off-topic messages. Allows borderline queries through.',
    color: 'text-green-400',
  },
  {
    value: 'medium',
    label: 'Balanced',
    desc: 'Default. Blocks clear off-topic messages, allows edge cases.',
    color: 'text-yellow-400',
  },
  {
    value: 'high',
    label: 'Strict',
    desc: 'Block anything not directly about tech or cybersecurity.',
    color: 'text-red-400',
  },
] as const;

const Toggle = ({
  enabled,
  onChange,
  label,
  desc,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
}) => (
  <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-800 last:border-0">
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-200">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
    </div>
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`shrink-0 mt-0.5 relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none ${
        enabled ? 'bg-[#00D4AA]' : 'bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

export default function SettingsPage() {
  const { getToken } = useAuth();

  const [tierLimits, setTierLimits] = useState<TierLimits>(DEFAULT_LIMITS);
  const [guardrail, setGuardrail] = useState<GuardrailConfig>(DEFAULT_GUARDRAIL);

  const [loading, setLoading] = useState(true);
  const [savingTier, setSavingTier] = useState(false);
  const [savingGuardrail, setSavingGuardrail] = useState(false);
  const [error, setError] = useState('');
  const [savedTier, setSavedTier] = useState(false);
  const [savedGuardrail, setSavedGuardrail] = useState(false);
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
        if (res.status === 503) { setSqlNote(true); setLoading(false); return; }
        throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load settings');
      }
      const { settings } = await res.json() as { settings: Array<{ key: string; value: unknown }> };
      const tierRow = settings.find(s => s.key === 'tier_limits');
      if (tierRow?.value && typeof tierRow.value === 'object') {
        setTierLimits(prev => ({ ...prev, ...(tierRow.value as Partial<TierLimits>) }));
      }
      const guardrailRow = settings.find(s => s.key === 'guardrail_config');
      if (guardrailRow?.value && typeof guardrailRow.value === 'object') {
        setGuardrail(prev => ({ ...prev, ...(guardrailRow.value as Partial<GuardrailConfig>) }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  const saveSetting = async (key: string, value: unknown, description: string) => {
    const headers = await authHeaders();
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ key, value, description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Save failed');
  };

  const handleSaveTier = async () => {
    setSavingTier(true);
    setError('');
    try {
      await saveSetting('tier_limits', tierLimits, 'Daily message limits per user tier. Use -1 for unlimited.');
      setSavedTier(true);
      setTimeout(() => setSavedTier(false), 3000);
    } catch (e) { setError((e as Error).message); }
    finally { setSavingTier(false); }
  };

  const handleSaveGuardrail = async () => {
    setSavingGuardrail(true);
    setError('');
    try {
      await saveSetting('guardrail_config', guardrail, 'Guardrail check toggles and off-topic strictness level.');
      setSavedGuardrail(true);
      setTimeout(() => setSavedGuardrail(false), 3000);
    } catch (e) { setError((e as Error).message); }
    finally { setSavingGuardrail(false); }
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
            <code className="text-yellow-400 text-xs">
              CREATE TABLE app_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, description TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
            </code>
          </div>
        </div>
      )}

      {/* ── Tier Limits ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-semibold text-white">Daily Message Limits</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Messages per day per tier. Use <code className="bg-gray-800 px-1 rounded">-1</code> for unlimited.
        </p>

        {loading ? (
          <div className="space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-800" />)}</div>
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
          {savedTier
            ? <span className="text-sm text-[#00D4AA]">✓ Saved</span>
            : <span className="text-xs text-gray-600">Changes apply to new messages immediately</span>
          }
          <button
            onClick={handleSaveTier}
            disabled={savingTier || loading || sqlNote}
            className="flex items-center gap-2 rounded-xl bg-[#00D4AA] px-4 py-2 text-sm font-medium text-gray-900 hover:bg-[#00D4AA]/90 disabled:opacity-50 transition-colors"
          >
            {savingTier ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" /> : <Save className="h-3.5 w-3.5" />}
            {savingTier ? 'Saving…' : 'Save Limits'}
          </button>
        </div>
      </div>

      {/* ── Guardrail Configuration ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-4 w-4 text-orange-400" />
          <h2 className="font-semibold text-white">Guardrail Configuration</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          Control which safety checks run on every message. Changes take effect immediately.
        </p>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-800" />)}</div>
        ) : (
          <>
            {/* Toggles */}
            <div className="rounded-xl border border-gray-800 bg-gray-800/40 px-4 mb-5">
              <Toggle
                enabled={guardrail.pii_check}
                onChange={v => setGuardrail(g => ({ ...g, pii_check: v }))}
                label="PII Detection"
                desc="Block messages containing passwords, OTPs, Aadhaar numbers, or card numbers"
              />
              <Toggle
                enabled={guardrail.off_topic_check}
                onChange={v => setGuardrail(g => ({ ...g, off_topic_check: v }))}
                label="Off-Topic Filter"
                desc="Block messages unrelated to tech support or cybersecurity"
              />
              <Toggle
                enabled={guardrail.unsafe_check}
                onChange={v => setGuardrail(g => ({ ...g, unsafe_check: v }))}
                label="Unsafe Content Filter"
                desc="Block requests for malware, hacking instructions, or harmful content"
              />
              <Toggle
                enabled={guardrail.output_pii_masking}
                onChange={v => setGuardrail(g => ({ ...g, output_pii_masking: v }))}
                label="Output PII Masking"
                desc="Redact Aadhaar numbers and card numbers from AI responses"
              />
            </div>

            {/* Strictness */}
            <div>
              <p className="text-sm font-medium text-gray-300 mb-1">Off-Topic Strictness</p>
              <p className="text-xs text-gray-500 mb-3">
                How aggressively the off-topic filter classifies borderline messages.
                Only applies when the Off-Topic Filter is enabled.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {STRICTNESS_OPTIONS.map(opt => {
                  const active = guardrail.off_topic_strictness === opt.value;
                  const Icon = opt.value === 'low' ? ShieldOff : opt.value === 'high' ? ShieldAlert : ShieldCheck;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGuardrail(g => ({ ...g, off_topic_strictness: opt.value }))}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        active
                          ? 'border-[#00D4AA] bg-[#00D4AA]/10'
                          : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#00D4AA]' : opt.color}`} />
                        <span className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-300'}`}>
                          {opt.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
          {savedGuardrail
            ? <span className="text-sm text-[#00D4AA]">✓ Saved</span>
            : <span className="text-xs text-gray-600">Changes apply to the next message sent</span>
          }
          <button
            onClick={handleSaveGuardrail}
            disabled={savingGuardrail || loading || sqlNote}
            className="flex items-center gap-2 rounded-xl bg-[#00D4AA] px-4 py-2 text-sm font-medium text-gray-900 hover:bg-[#00D4AA]/90 disabled:opacity-50 transition-colors"
          >
            {savingGuardrail ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" /> : <Save className="h-3.5 w-3.5" />}
            {savingGuardrail ? 'Saving…' : 'Save Guardrails'}
          </button>
        </div>
      </div>

      {/* Future placeholder */}
      <div className="rounded-2xl border border-gray-700/50 bg-gray-900/50 p-4">
        <p className="text-sm text-gray-500">More settings — KB categories, branding — coming in future sprints.</p>
      </div>
    </div>
  );
}
