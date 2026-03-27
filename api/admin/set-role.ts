import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';
import { verifyAdminRequest, sendAuthError } from '../_lib/adminAuth.js';
import { writeAuditLog } from '../_lib/auditLog.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  let admin;
  try {
    admin = await verifyAdminRequest(req);
  } catch (e) {
    return sendAuthError(res, e);
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
    // Fetch current role for the audit payload
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('clerk_id', targetUserId)
      .single();

    await clerkBackend.users.updateUserMetadata(targetUserId, {
      publicMetadata: { role },
    });

    await supabaseAdmin
      .from('users')
      .update({ role })
      .eq('clerk_id', targetUserId);

    // Write audit log (non-fatal)
    await writeAuditLog(supabaseAdmin, {
      adminClerkId: admin.clerkId,
      adminEmail: admin.email,
      action: 'set_role',
      targetType: 'user',
      targetId: targetUserId,
      payload: { previousRole: targetUser?.role ?? null, newRole: role },
      ipAddress: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim(),
    });

    return res.status(200).json({ ok: true, role });
  } catch (e) {
    console.error('Failed to update role:', e);
    return res.status(500).json({ error: (e as Error).message });
  }
}
