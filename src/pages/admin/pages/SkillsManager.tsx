import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Zap, X, Check } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  system_prompt: string;
  is_active: boolean;
  sort_order: number;
  created_by_email: string | null;
  created_at: string;
}

const BLANK: Omit<Skill, 'id' | 'created_by_email' | 'created_at' | 'is_active'> = {
  name: '',
  slug: '',
  description: '',
  icon: '🛡️',
  color: '#00D4AA',
  system_prompt: '',
  sort_order: 99,
};

const COLOR_PRESETS = ['#00D4AA', '#6366F1', '#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

export default function SkillsManager() {
  const { getToken } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Skill | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const authHeaders = async () => {
    const token = await getToken();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/skills', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setSkills(data.skills ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setForm({ ...BLANK });
    setFormError('');
    setEditTarget(null);
    setModal('create');
  };

  const openEdit = (skill: Skill) => {
    setForm({
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      icon: skill.icon,
      color: skill.color,
      system_prompt: skill.system_prompt,
      sort_order: skill.sort_order,
    });
    setFormError('');
    setEditTarget(skill);
    setModal('edit');
  };

  const handleSlugify = (name: string) =>
    name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    if (!form.slug.trim()) { setFormError('Slug is required'); return; }
    if (!form.system_prompt.trim()) { setFormError('System prompt is required'); return; }

    setSaving(true);
    setFormError('');
    try {
      const headers = await authHeaders();
      let res: Response;
      if (modal === 'create') {
        res = await fetch('/api/admin/skills', {
          method: 'POST',
          headers,
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch(`/api/admin/skills?id=${editTarget!.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(form),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setModal(null);
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (skill: Skill) => {
    try {
      const headers = await authHeaders();
      await fetch(`/api/admin/skills?id=${skill.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_active: !skill.is_active }),
      });
      await load();
    } catch {
      // non-fatal
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/skills?id=${deleteId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Delete failed');
      setDeleteId(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#00D4AA]" />
            Skills
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Configure AI response modes shown to users in the chat interface
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-[#00D4AA] px-4 py-2 text-sm font-medium text-gray-900 hover:bg-[#00D4AA]/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Skill
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Skills grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500 text-sm">Loading…</div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-800 bg-gray-900/40 py-20">
          <Zap className="h-10 w-10 text-gray-700" />
          <p className="text-gray-400 text-sm">No skills yet. Create your first skill.</p>
          <button
            onClick={openCreate}
            className="mt-1 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-4 py-2 text-sm text-[#00D4AA] hover:bg-[#00D4AA]/20 transition-colors"
          >
            + New Skill
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map(skill => (
            <div
              key={skill.id}
              className={`relative rounded-2xl border bg-gray-900 p-5 flex flex-col gap-3 transition-all ${
                skill.is_active ? 'border-gray-700' : 'border-gray-800 opacity-60'
              }`}
            >
              {/* Icon + name */}
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: `${skill.color}20`, border: `1px solid ${skill.color}40` }}
                >
                  {skill.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white leading-tight">{skill.name}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{skill.slug}</p>
                </div>
                <button
                  onClick={() => handleToggle(skill)}
                  className="shrink-0 text-gray-500 hover:text-white transition-colors"
                  title={skill.is_active ? 'Deactivate' : 'Activate'}
                >
                  {skill.is_active
                    ? <ToggleRight className="h-5 w-5 text-[#00D4AA]" />
                    : <ToggleLeft className="h-5 w-5" />
                  }
                </button>
              </div>

              {skill.description && (
                <p className="text-xs text-gray-400 leading-relaxed">{skill.description}</p>
              )}

              {/* System prompt preview */}
              <div className="rounded-lg bg-gray-800 px-3 py-2">
                <p className="text-xs text-gray-500 font-medium mb-1">System Prompt</p>
                <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{skill.system_prompt}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-1">
                <button
                  onClick={() => openEdit(skill)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-white transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => setDeleteId(skill.id)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-500 border border-red-900 hover:border-red-700 hover:text-red-400 transition-colors ml-auto"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 shrink-0">
              <h2 className="text-base font-semibold text-white">
                {modal === 'create' ? 'New Skill' : 'Edit Skill'}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="rounded-lg p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-800 bg-red-900/20 px-3 py-2 text-xs text-red-400">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
                  <input
                    value={form.name}
                    onChange={e => {
                      const name = e.target.value;
                      setForm(f => ({
                        ...f,
                        name,
                        slug: modal === 'create' ? handleSlugify(name) : f.slug,
                      }));
                    }}
                    placeholder="e.g. Threat Intel"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#00D4AA] focus:outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Slug * (auto-filled)</label>
                  <input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: handleSlugify(e.target.value) }))}
                    placeholder="threat_intel"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#00D4AA] focus:outline-none font-mono"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Icon (emoji)</label>
                  <input
                    value={form.icon}
                    onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                    placeholder="🛡️"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#00D4AA] focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                      className="h-9 w-9 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer p-0.5"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, color: c }))}
                          className="h-6 w-6 rounded-full border-2 transition-all"
                          style={{
                            backgroundColor: c,
                            borderColor: form.color === c ? 'white' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                  <input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description shown on the pill tooltip"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#00D4AA] focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    System Prompt *
                    <span className="ml-1 text-gray-600">(injected into AI context when skill is active)</span>
                  </label>
                  <textarea
                    value={form.system_prompt}
                    onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                    rows={5}
                    placeholder="USER HAS THREAT INTEL MODE ENABLED: Provide detailed threat intelligence. Include CVE numbers, MITRE ATT&CK technique IDs, CVSS scores, and known IOCs where relevant."
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#00D4AA] focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Sort Order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 99 }))}
                    min={0}
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-[#00D4AA] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 border-t border-gray-800 px-6 py-4 shrink-0">
              <button
                onClick={() => setModal(null)}
                className="rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#00D4AA] px-4 py-2 text-sm font-medium text-gray-900 hover:bg-[#00D4AA]/90 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {saving ? 'Saving…' : 'Save Skill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-white mb-2">Delete Skill?</h2>
            <p className="text-sm text-gray-400 mb-6">
              This will permanently delete the skill and remove it from the chat UI. Active users with this skill selected will no longer get its system prompt.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
