import { useState, useEffect, useCallback } from 'react';
import { useAdminToken } from '../../../hooks/useAdminToken';
import { Megaphone, Plus, X, RefreshCw, AlertCircle } from 'lucide-react';

interface Announcement {
  id: string;
  message: string;
  is_active: boolean;
  created_by_email: string;
  created_at: string;
  expires_at: string | null;
}

const BroadcastPage = () => {
  const adminFetch = useAdminToken();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [migrationNote, setMigrationNote] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/broadcast');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const handlePost = async () => {
    if (!message.trim()) { setFormError('Message cannot be empty'); return; }
    setPosting(true);
    setFormError(null);
    try {
      const res = await adminFetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), expiresAt: expiresAt || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503) setMigrationNote(true);
        setFormError(body.error ?? `Error ${res.status}`);
        return;
      }
      setMessage('');
      setExpiresAt('');
      setShowForm(false);
      fetchAnnouncements();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await adminFetch(`/api/admin/broadcast?id=${id}`, { method: 'DELETE' });
      fetchAnnouncements();
    } catch { /* ignore */ }
  };

  const active = announcements.filter(a => a.is_active);
  const inactive = announcements.filter(a => !a.is_active);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Broadcast</h1>
          <p className="text-sm text-gray-400">Post announcements visible to all users in the chat</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAnnouncements}
            className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-[#00D4AA] hover:text-[#00D4AA] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setShowForm(v => !v); setFormError(null); }}
            className="flex items-center gap-2 rounded-xl bg-[#00D4AA]/15 px-4 py-1.5 text-sm font-medium text-[#00D4AA] hover:bg-[#00D4AA]/25 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Announcement
          </button>
        </div>
      </div>

      {migrationNote && (
        <div className="rounded-xl border border-yellow-700/40 bg-yellow-900/20 p-4 text-sm text-yellow-300">
          <p className="font-semibold mb-2">SQL migration required</p>
          <p className="text-xs text-yellow-400 mb-2">Run this in your Supabase SQL editor:</p>
          <pre className="bg-black/30 rounded p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL
);`}
          </pre>
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5 space-y-4">
          <h2 className="font-semibold text-white">New Announcement</h2>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            placeholder="Type your announcement message..."
            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00D4AA] focus:outline-none resize-none"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Expires at (optional)</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-[#00D4AA] focus:outline-none"
              />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <button
                onClick={() => { setShowForm(false); setFormError(null); }}
                className="rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                disabled={posting || !message.trim()}
                className="rounded-xl bg-[#00D4AA] px-4 py-2 text-sm font-medium text-gray-950 hover:bg-[#00bfa0] disabled:opacity-50 transition-colors"
              >
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {formError}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Active */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900">
        <div className="border-b border-gray-800 px-5 py-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <h2 className="font-semibold text-white">Active ({active.length})</h2>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Megaphone className="h-8 w-8 text-gray-700" />
            <p className="text-gray-500 text-sm">No active announcements</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {active.map(a => (
              <li key={a.id} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{a.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    By {a.created_by_email} · {new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {a.expires_at && ` · Expires ${new Date(a.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDeactivate(a.id)}
                  className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-red-400 transition-colors"
                  title="Deactivate"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 px-5 py-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gray-600" />
            <h2 className="font-semibold text-gray-400">Inactive ({inactive.length})</h2>
          </div>
          <ul className="divide-y divide-gray-800">
            {inactive.slice(0, 10).map(a => (
              <li key={a.id} className="px-5 py-3">
                <p className="text-gray-500 text-sm line-through">{a.message}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BroadcastPage;
