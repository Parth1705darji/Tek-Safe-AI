import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const adminEmail = process.env.VITE_ADMIN_EMAIL;
  const requestingEmail = req.headers['x-admin-email'] as string;

  if (!adminEmail || requestingEmail !== adminEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const rawPage = parseInt((req.query.page as string) ?? '1');
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const limit = 20;
  const offset = (page - 1) * limit;
  const search = (req.query.search as string) ?? '';
  const tier = (req.query.tier as string) ?? '';
  const role = (req.query.role as string) ?? '';

  let query = supabase
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
  }
  if (tier) {
    query = query.eq('tier', tier);
  }
  if (role) {
    query = query.eq('role', role);
  }

  const { data, error, count } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    users: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}
