import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest, sendAuthError } from '../../lib/adminAuth.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = req.query.resource as string;
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── skills GET: public (no auth) returns active skills for chat UI ───────────
  if (resource === 'skills' && req.method === 'GET') {
    const isAdminRequest = (req.headers.authorization as string | undefined)?.startsWith('Bearer ');

    if (!isAdminRequest) {
      const { data, error } = await supabase
        .from('skills')
        .select('id, name, slug, description, icon, color, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        if (error.code === '42P01') return res.status(200).json({ skills: [] });
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ skills: data ?? [] });
    }
    // Authenticated request falls through to admin handler below
  }

  // ── broadcast GET: public if no auth header, admin view if authenticated ─────
  if (resource === 'broadcast' && req.method === 'GET') {
    const isAdminRequest = (req.headers.authorization as string | undefined)?.startsWith('Bearer ');

    if (!isAdminRequest) {
      // Public: return only active, non-expired announcements for the chat banner
      const { data, error } = await supabase
        .from('announcements')
        .select('id, message, created_at, expires_at, is_active')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return res.status(200).json({ announcements: [] });
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ announcements: data ?? [] });
    }
    // Authenticated request falls through to the admin handler below
  }

  // All other routes require admin auth
  let admin;
  try {
    admin = await verifyAdminRequest(req);
  } catch (e) {
    return sendAuthError(res, e);
  }

  // ── audit-log: GET /api/admin/audit-log ────────────────────────────────────
  if (resource === 'audit-log') {
    if (req.method !== 'GET') return res.status(405).end();

    const rawPage = parseInt((req.query.page as string) ?? '1');
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = 25;
    const offset = (page - 1) * limit;
    const actionFilter = req.query.action as string | undefined;

    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (actionFilter) query = query.eq('action', actionFilter);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      entries: data ?? [],
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  }

  // ── broadcast: POST|DELETE /api/admin/broadcast (GET handled above) ─────────
  if (resource === 'broadcast') {
    if (req.method === 'GET') {
      // Admin view: return all announcements including inactive
      const { data, error } = await supabase
        .from('announcements')
        .select('id, message, created_by_email, created_at, expires_at, is_active')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        if (error.code === '42P01') return res.status(200).json({ announcements: [] });
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ announcements: data ?? [] });
    }

    if (req.method === 'POST') {
      const { message, expiresAt } = req.body as { message?: string; expiresAt?: string };
      if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

      const { data, error } = await supabase
        .from('announcements')
        .insert({
          message: message.trim(),
          is_active: true,
          created_by_email: admin.email,
          expires_at: expiresAt ?? null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          return res.status(503).json({
            error: 'Run SQL migration first: CREATE TABLE announcements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), message TEXT NOT NULL, is_active BOOLEAN DEFAULT TRUE, created_by_email TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ)',
          });
        }
        return res.status(500).json({ error: error.message });
      }
      return res.status(201).json({ announcement: data });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query as { id?: string };
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const { error } = await supabase
        .from('announcements')
        .update({ is_active: false })
        .eq('id', id);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  }

  // ── skills: GET all (admin) | POST create | PUT update | DELETE ──────────────
  if (resource === 'skills') {
    if (req.method === 'GET') {
      // Admin: return all skills including inactive
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        if (error.code === '42P01') return res.status(200).json({ skills: [] });
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ skills: data ?? [] });
    }

    if (req.method === 'POST') {
      const { name, slug, description, icon, color, system_prompt, sort_order } = req.body as {
        name?: string;
        slug?: string;
        description?: string;
        icon?: string;
        color?: string;
        system_prompt?: string;
        sort_order?: number;
      };
      if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
      if (!slug?.trim()) return res.status(400).json({ error: 'slug is required' });
      if (!system_prompt?.trim()) return res.status(400).json({ error: 'system_prompt is required' });

      const { data, error } = await supabase
        .from('skills')
        .insert({
          name: name.trim(),
          slug: slug.trim().toLowerCase().replace(/\s+/g, '_'),
          description: description?.trim() ?? '',
          icon: icon?.trim() ?? '🛡️',
          color: color?.trim() ?? '#00D4AA',
          system_prompt: system_prompt.trim(),
          sort_order: sort_order ?? 99,
          is_active: true,
          created_by_email: admin.email,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          return res.status(503).json({ error: 'Run SQL migration first to create the skills table.' });
        }
        if (error.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
        return res.status(500).json({ error: error.message });
      }

      await supabase.from('admin_audit_log').insert({
        admin_email: admin.email,
        action: 'skill_created',
        payload: { skill_id: data.id, name: data.name, slug: data.slug },
      }).catch(() => {});

      return res.status(201).json({ skill: data });
    }

    if (req.method === 'PUT') {
      const { id } = req.query as { id?: string };
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const { name, description, icon, color, system_prompt, sort_order, is_active } = req.body as {
        name?: string;
        description?: string;
        icon?: string;
        color?: string;
        system_prompt?: string;
        sort_order?: number;
        is_active?: boolean;
      };

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description.trim();
      if (icon !== undefined) updates.icon = icon.trim();
      if (color !== undefined) updates.color = color.trim();
      if (system_prompt !== undefined) updates.system_prompt = system_prompt.trim();
      if (sort_order !== undefined) updates.sort_order = sort_order;
      if (is_active !== undefined) updates.is_active = is_active;

      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

      const { data, error } = await supabase
        .from('skills')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Skill not found' });

      await supabase.from('admin_audit_log').insert({
        admin_email: admin.email,
        action: 'skill_updated',
        payload: { skill_id: id, changes: updates },
      }).catch(() => {});

      return res.status(200).json({ skill: data });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query as { id?: string };
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const { error } = await supabase.from('skills').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });

      await supabase.from('admin_audit_log').insert({
        admin_email: admin.email,
        action: 'skill_deleted',
        payload: { skill_id: id },
      }).catch(() => {});

      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  }

  // ── settings: GET all | PUT upsert key-value ─────────────────────────────
  if (resource === 'settings') {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('app_settings').select('*').order('key');
      if (error) {
        if (error.code === '42P01') return res.status(200).json({ settings: [] });
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ settings: data ?? [] });
    }

    if (req.method === 'PUT') {
      const { key, value, description } = req.body as { key?: string; value?: unknown; description?: string };
      if (!key) return res.status(400).json({ error: 'key is required' });

      const { error } = await supabase.from('app_settings').upsert({
        key,
        value,
        description: description ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

      if (error) {
        if (error.code === '42P01') return res.status(503).json({ error: 'Run SQL migration to create app_settings table.' });
        return res.status(500).json({ error: error.message });
      }

      await supabase.from('admin_audit_log').insert({
        admin_email: admin.email,
        action: 'setting_updated',
        payload: { key, value },
      }).catch(() => {});

      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  }

  return res.status(404).json({ error: `Unknown resource: ${resource}` });
}
