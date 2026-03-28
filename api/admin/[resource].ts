import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest, sendAuthError } from '../_lib/adminAuth.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = req.query.resource as string;
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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

  return res.status(404).json({ error: `Unknown resource: ${resource}` });
}
