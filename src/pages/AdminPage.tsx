import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { Shield, Users, MessageSquare, ThumbsUp, ThumbsDown, Trash2, Plus, X, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { ADMIN_EMAIL } from '../lib/adminService';
import { cn } from '../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminStats {
  users: { total: number; today: number; thisWeek: number };
  messages: { total: number; today: number; thisWeek: number };
  tools: Record<string, number>;
  feedback: { up: number; down: number };
  recentUsers: Array<{
    id: string;
    email: string;
    display_name: string | null;
    tier: string;
    daily_message_count: number;
    created_at: string;
  }>;
  kbDocuments: Array<{
    id: string;
    title: string;
    category: string;
    subcategory: string;
    tags: string[];
    created_at: string;
  }>;
}

interface ArticleForm {
  title: string;
  category: 'tech_support' | 'cybersecurity';
  subcategory: string;
  tags: string;
  content: string;
}

const EMPTY_FORM: ArticleForm = {
  title: '',
  category: 'tech_support',
  subcategory: '',
  tags: '',
  content: '',
};

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  title,
  main,
  sub1Label,
  sub1Val,
  sub2Label,
  sub2Val,
  icon: Icon,
  accent = false,
}: {
  title: string;
  main: number | string;
  sub1Label: string;
  sub1Val: number | string;
  sub2Label: string;
  sub2Val: number | string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-dark-surface">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent ? 'bg-accent/10' : 'bg-primary/10')}>
          <Icon className={cn('h-4 w-4', accent ? 'text-accent' : 'text-primary')} />
        </div>
      </div>
      <p className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">{main}</p>
      <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span><span className="font-medium text-gray-700 dark:text-gray-300">{sub1Val}</span> {sub1Label}</span>
        <span><span className="font-medium text-gray-700 dark:text-gray-300">{sub2Val}</span> {sub2Label}</span>
      </div>
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────────────────────────

const AdminPage = () => {
  const { user, isLoaded } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ArticleForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-email': userEmail },
      });
      if (res.ok) {
        const data = (await res.json()) as AdminStats;
        setStats(data);
      }
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Guard — redirect non-admins
  if (!isLoaded) return null;
  if (!userEmail || userEmail !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  const feedbackTotal = (stats?.feedback.up ?? 0) + (stats?.feedback.down ?? 0);
  const satisfactionPct = feedbackTotal > 0 ? Math.round(((stats?.feedback.up ?? 0) / feedbackTotal) * 100) : null;

  const handleSubmitArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch('/api/admin/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': userEmail },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          subcategory: form.subcategory,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          content: form.content,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; chunksEmbedded?: number; totalChunks?: number; error?: string };
      if (res.ok && data.ok) {
        setSubmitResult({ ok: true, msg: `Saved! ${data.chunksEmbedded}/${data.totalChunks} chunks embedded.` });
        setForm(EMPTY_FORM);
        setShowForm(false);
        fetchStats();
      } else {
        setSubmitResult({ ok: false, msg: data.error ?? 'Unknown error' });
      }
    } catch (err) {
      setSubmitResult({ ok: false, msg: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteArticle = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This also removes all its embeddings.`)) return;
    if (!userEmail) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/kb?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-email': userEmail },
      });
      fetchStats();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-gray-200 bg-white/90 px-6 backdrop-blur dark:border-gray-800 dark:bg-dark-bg/90">
        <Shield className="mr-2 h-5 w-5 text-accent" />
        <span className="font-semibold text-gray-900 dark:text-white">Tek-Safe Admin</span>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">

        {/* Section A — Stats */}
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Overview</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Users"
              main={stats?.users.total ?? '—'}
              sub1Label="today"
              sub1Val={stats?.users.today ?? '—'}
              sub2Label="this week"
              sub2Val={stats?.users.thisWeek ?? '—'}
              icon={Users}
            />
            <StatCard
              title="AI Responses"
              main={stats?.messages.total ?? '—'}
              sub1Label="today"
              sub1Val={stats?.messages.today ?? '—'}
              sub2Label="this week"
              sub2Val={stats?.messages.thisWeek ?? '—'}
              icon={MessageSquare}
              accent
            />
            {/* Tool Usage */}
            <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-dark-surface">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tool Usage</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="space-y-1">
                {['breach_check', 'url_scan', 'ip_check'].map((tool) => (
                  <div key={tool} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{tool.replace('_', ' ')}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{stats?.tools[tool] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Feedback */}
            <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-dark-surface">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Satisfaction</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                  <ThumbsUp className="h-4 w-4 text-accent" />
                </div>
              </div>
              <p className={cn('mb-2 text-3xl font-bold', satisfactionPct !== null ? (satisfactionPct >= 70 ? 'text-green-600' : satisfactionPct >= 40 ? 'text-yellow-600' : 'text-red-500') : 'text-gray-900 dark:text-white')}>
                {satisfactionPct !== null ? `${satisfactionPct}%` : '—'}
              </p>
              <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3 text-green-500" />{stats?.feedback.up ?? 0}</span>
                <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3 text-red-400" />{stats?.feedback.down ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section B — Knowledge Base */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Knowledge Base</h2>
            <button
              onClick={() => { setShowForm((v) => !v); setSubmitResult(null); }}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90"
            >
              {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showForm ? 'Cancel' : 'Add Article'}
            </button>
          </div>

          {/* Add Article form */}
          {showForm && (
            <form onSubmit={handleSubmitArticle} className="mb-6 rounded-card border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-dark-surface space-y-4">
              <h3 className="font-semibold text-gray-800 dark:text-white">New KB Article</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Title *</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    placeholder="e.g. How to secure your WiFi router"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ArticleForm['category'] }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="tech_support">Tech Support</option>
                    <option value="cybersecurity">Cybersecurity</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Subcategory *</label>
                  <input
                    required
                    value={form.subcategory}
                    onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    placeholder="e.g. Network Security"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Tags (comma-separated)</label>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    placeholder="wifi, router, password"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Content *</label>
                <textarea
                  required
                  rows={8}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-accent dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  placeholder="Write the full article content here…"
                />
              </div>
              {submitResult && (
                <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', submitResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400')}>
                  {submitResult.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  {submitResult.msg}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
              >
                {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                {submitting ? 'Saving & Embedding…' : 'Save & Embed Article'}
              </button>
            </form>
          )}

          {/* KB Articles table */}
          <div className="overflow-hidden rounded-card border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Category</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:table-cell">Subcategory</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell">Tags</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && (stats?.kbDocuments ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                      No articles yet. Add one above.
                    </td>
                  </tr>
                )}
                {(stats?.kbDocuments ?? []).map((doc) => (
                  <tr key={doc.id} className="bg-white hover:bg-gray-50 dark:bg-dark-surface dark:hover:bg-gray-800/40">
                    <td className="max-w-[200px] truncate px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{doc.title}</td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', doc.category === 'cybersecurity' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400')}>
                        {doc.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 sm:table-cell">{doc.subcategory}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(doc.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteArticle(doc.id, doc.title)}
                        disabled={deletingId === doc.id}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === doc.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section C — Recent Users */}
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Recent Users</h2>
          <div className="overflow-hidden rounded-card border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Messages Today</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {(stats?.recentUsers ?? []).map((u) => (
                  <tr key={u.id} className="bg-white hover:bg-gray-50 dark:bg-dark-surface dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{u.display_name ?? '—'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', u.tier === 'premium' ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400')}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{u.daily_message_count}</td>
                    <td className="hidden px-4 py-3 text-gray-500 dark:text-gray-400 sm:table-cell">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(stats?.recentUsers ?? []).length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">No users yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section D — System Status */}
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">System Status</h2>
          <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-dark-surface">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: 'DeepSeek API', ok: true },
                { label: 'OpenAI Embeddings', ok: !!import.meta.env.VITE_SUPABASE_URL },
                { label: 'Supabase', ok: !!import.meta.env.VITE_SUPABASE_URL },
                { label: 'Clerk Auth', ok: !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY },
                { label: 'Admin Email', ok: !!import.meta.env.VITE_ADMIN_EMAIL },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-2 rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                  {ok ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPage;
