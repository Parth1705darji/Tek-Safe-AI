import { useState, useEffect, useCallback, Fragment } from 'react';
import { useUser } from '@clerk/react';
import { Plus, Edit2, Trash2, Search, X, Tag } from 'lucide-react';
import { showToast } from '../../../components/common/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

interface KBArticle {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  tags: string[];
  content?: string;
  created_at: string;
}

const CATEGORIES = ['tech_support', 'cybersecurity'];

const KBManager = () => {
  const { user } = useUser();
  const adminEmail = user?.primaryEmailAddress?.emailAddress ?? '';

  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'cybersecurity',
    subcategory: '',
    tags: [] as string[],
    content: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-email': adminEmail },
      });
      if (res.ok) {
        const data = await res.json();
        setArticles(data.kbDocuments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [adminEmail]);

  useEffect(() => {
    if (adminEmail) fetchArticles();
  }, [adminEmail, fetchArticles]);

  const filtered = articles.filter(a => {
    const matchesSearch = !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.subcategory.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const openAdd = () => {
    setEditingArticle(null);
    setFormData({ title: '', category: 'cybersecurity', subcategory: '', tags: [], content: '' });
    setTagInput('');
    setFormOpen(true);
  };

  const openEdit = (article: KBArticle) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      category: article.category,
      subcategory: article.subcategory,
      tags: article.tags ?? [],
      content: article.content ?? '',
    });
    setTagInput('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingArticle(null);
  };

  const addTag = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,$/, '');
      if (!formData.tags.includes(tag)) {
        setFormData(f => ({ ...f, tags: [...f.tags, tag] }));
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      showToast('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/kb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail,
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Save failed');
      }
      showToast('Article saved and embedded');
      closeForm();
      await fetchArticles();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/kb?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-email': adminEmail },
      });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Article deleted');
      setArticles(prev => prev.filter(a => a.id !== id));
      setDeleteConfirm(null);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Knowledge Base</h1>
          <p className="text-sm text-gray-400">{articles.length} articles · AI-powered semantic search</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-[#00D4AA] px-4 py-2 text-sm font-medium text-gray-950 hover:bg-[#00D4AA]/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Article
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search articles..."
            className="w-full rounded-xl border border-gray-700 bg-gray-800 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:border-[#00D4AA] focus:outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-[#00D4AA] focus:outline-none"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Add/Edit Form */}
      {formOpen && (
        <div className="rounded-2xl border border-[#00D4AA]/30 bg-gray-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">
              {editingArticle ? 'Edit Article' : 'New Article'}
            </h2>
            <button onClick={closeForm} className="text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-400">Title *</label>
                <input
                  value={formData.title}
                  onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  placeholder="Article title"
                  required
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00D4AA] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-[#00D4AA] focus:outline-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Subcategory *</label>
                <input
                  value={formData.subcategory}
                  onChange={e => setFormData(f => ({ ...f, subcategory: e.target.value }))}
                  placeholder="e.g. phishing, ssl, dns"
                  required
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00D4AA] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Tags (press Enter or comma to add)</label>
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-gray-700 bg-gray-800 p-2">
                {formData.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-gray-500 hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                  placeholder={formData.tags.length === 0 ? 'Add tags...' : ''}
                  className="flex-1 min-w-[80px] bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Content * (Markdown supported)</label>
              <textarea
                value={formData.content}
                onChange={e => setFormData(f => ({ ...f, content: e.target.value }))}
                placeholder="Write the article content here. Markdown is supported."
                required
                rows={8}
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00D4AA] focus:outline-none resize-y"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#00D4AA] px-4 py-2 text-sm font-medium text-gray-950 hover:bg-[#00D4AA]/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving & Embedding...' : 'Save & Embed Article'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Articles Table */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Title</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Category</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Subcategory</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Tags</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingSkeleton variant="table-row" count={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <p className="text-gray-400">
                      {search || categoryFilter ? 'No articles match your filters' : 'No articles yet. Add your first article →'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(article => (
                  <Fragment key={article.id}>
                    <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-5 py-3">
                        <p className="max-w-[240px] truncate font-medium text-white">{article.title}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          article.category === 'cybersecurity'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {article.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400">{article.subcategory}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(article.tags ?? []).slice(0, 3).map(tag => (
                            <span key={tag} className="rounded-full bg-gray-700 px-1.5 py-0.5 text-xs text-gray-400">{tag}</span>
                          ))}
                          {(article.tags ?? []).length > 3 && (
                            <span className="text-xs text-gray-500">+{article.tags.length - 3} more</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(article)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(article.id)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {deleteConfirm === article.id && (
                      <tr className="border-b border-gray-800/50 bg-gray-800/20">
                        <td colSpan={5} className="px-5 py-2">
                          <ConfirmModal
                            message={`Delete "${article.title}"? This cannot be undone.`}
                            onConfirm={() => handleDelete(article.id)}
                            onCancel={() => setDeleteConfirm(null)}
                            isLoading={deleting}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default KBManager;
