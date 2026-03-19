import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminEmail = process.env.VITE_ADMIN_EMAIL;
  const requestingEmail = req.headers['x-admin-email'] as string;

  if (!adminEmail || requestingEmail !== adminEmail) {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }

  if (!process.env.CLERK_SECRET_KEY) {
    return res.status(500).json({ error: 'Clerk not configured' });
  }

  const body = req.body as {
    targetUserId?: string;
    role?: 'user' | 'admin';
  };

  const { targetUserId, role } = body;

  if (!targetUserId || !role) {
    return res.status(400).json({ error: 'Missing targetUserId or role' });
  }

  if (role !== 'user' && role !== 'admin') {
    return res.status(400).json({ error: 'Role must be "user" or "admin"' });
  }

  const clerkBackend = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    await clerkBackend.users.updateUserMetadata(targetUserId, {
      publicMetadata: { role },
    });

    await supabaseAdmin
      .from('users')
      .update({ role })
      .eq('clerk_id', targetUserId);

    return res.status(200).json({ ok: true, role });
  } catch (e) {
    console.error('Failed to update role:', e);
    return res.status(500).json({ error: (e as Error).message });
  }
}
