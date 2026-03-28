import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';
import { verifyAdminRequest, sendAuthError } from '../../lib/adminAuth.js';
import { writeAuditLog } from '../../lib/auditLog.js';
import { sendEmail, suspensionEmailHtml } from '../../lib/email.js';

export const config = { api: { bodyParser: true } };

type Action = 'set_role' | 'set_tier' | 'suspend' | 'unsuspend' | 'reset_quota' | 'delete_user';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  let admin;
  try {
    admin = await verifyAdminRequest(req);
  } catch (e) {
    return sendAuthError(res, e);
  }

  const body = req.body as {
    action?: Action;
    clerkId?: string;
    tier?: string;
    role?: 'user' | 'admin';
    reason?: string;
  };

  const { action, clerkId } = body;

  if (!action || !clerkId) {
    return res.status(400).json({ error: 'Missing action or clerkId' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim();

  // ── set_role ──────────────────────────────────────────────────────────────
  if (action === 'set_role') {
    const { role } = body;
    if (role !== 'user' && role !== 'admin') {
      return res.status(400).json({ error: 'Role must be "user" or "admin"' });
    }
    if (!process.env.CLERK_SECRET_KEY) {
      return res.status(500).json({ error: 'Clerk not configured' });
    }
    const { data: prev } = await supabase
      .from('users').select('role').eq('clerk_id', clerkId).single();

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    await clerk.users.updateUserMetadata(clerkId, { publicMetadata: { role } });
    const { error } = await supabase.from('users').update({ role }).eq('clerk_id', clerkId);
    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(supabase, {
      adminClerkId: admin.clerkId, adminEmail: admin.email,
      action: 'set_role', targetType: 'user', targetId: clerkId,
      payload: { previousRole: prev?.role ?? null, newRole: role }, ipAddress: ip,
    });
    return res.status(200).json({ ok: true, role });
  }

  // ── set_tier ──────────────────────────────────────────────────────────────
  if (action === 'set_tier') {
    const tier = body.tier as string | undefined;
    const VALID_TIERS = ['free', 'pro', 'team', 'premium'];
    if (!tier || !VALID_TIERS.includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const { data: prev } = await supabase
      .from('users').select('tier').eq('clerk_id', clerkId).single();

    const { error } = await supabase
      .from('users').update({ tier }).eq('clerk_id', clerkId);
    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(supabase, {
      adminClerkId: admin.clerkId, adminEmail: admin.email,
      action: 'set_tier', targetType: 'user', targetId: clerkId,
      payload: { previousTier: prev?.tier ?? null, newTier: tier }, ipAddress: ip,
    });

    return res.status(200).json({ ok: true, tier });
  }

  // ── suspend ────────────────────────────────────────────────────────────────
  if (action === 'suspend') {
    // Fetch email before update for notification
    const { data: targetUser } = await supabase
      .from('users').select('email, display_name').eq('clerk_id', clerkId).single();

    const { error } = await supabase
      .from('users')
      .update({
        is_suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_reason: body.reason ?? null,
      })
      .eq('clerk_id', clerkId);
    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(supabase, {
      adminClerkId: admin.clerkId, adminEmail: admin.email,
      action: 'suspend_user', targetType: 'user', targetId: clerkId,
      payload: { reason: body.reason ?? null }, ipAddress: ip,
    });

    // Send suspension notification email (non-fatal)
    if (targetUser?.email) {
      sendEmail({
        to: targetUser.email,
        subject: 'Your Tek-Safe AI account has been suspended',
        html: suspensionEmailHtml(targetUser.display_name ?? '', body.reason),
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true });
  }

  // ── unsuspend ──────────────────────────────────────────────────────────────
  if (action === 'unsuspend') {
    const { error } = await supabase
      .from('users')
      .update({ is_suspended: false, suspended_at: null, suspended_reason: null })
      .eq('clerk_id', clerkId);
    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(supabase, {
      adminClerkId: admin.clerkId, adminEmail: admin.email,
      action: 'unsuspend_user', targetType: 'user', targetId: clerkId,
      ipAddress: ip,
    });

    return res.status(200).json({ ok: true });
  }

  // ── reset_quota ────────────────────────────────────────────────────────────
  if (action === 'reset_quota') {
    const { error } = await supabase
      .from('users')
      .update({ daily_message_count: 0 })
      .eq('clerk_id', clerkId);
    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog(supabase, {
      adminClerkId: admin.clerkId, adminEmail: admin.email,
      action: 'reset_quota', targetType: 'user', targetId: clerkId,
      ipAddress: ip,
    });

    return res.status(200).json({ ok: true });
  }

  // ── delete_user ────────────────────────────────────────────────────────────
  if (action === 'delete_user') {
    // Get Supabase user id first (for cascade delete of conversations/messages)
    const { data: dbUser } = await supabase
      .from('users').select('id').eq('clerk_id', clerkId).single();

    if (dbUser?.id) {
      // Messages are cascade-deleted with conversations if FK is set;
      // delete explicitly to be safe
      const { data: convs } = await supabase
        .from('conversations').select('id').eq('user_id', dbUser.id);
      const convIds = (convs ?? []).map(c => c.id);
      if (convIds.length > 0) {
        await supabase.from('messages').delete().in('conversation_id', convIds);
        await supabase.from('conversations').delete().in('id', convIds);
      }
      await supabase.from('users').delete().eq('id', dbUser.id);
    }

    // Delete from Clerk
    if (process.env.CLERK_SECRET_KEY) {
      try {
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
        await clerk.users.deleteUser(clerkId);
      } catch (e) {
        console.warn('Clerk user deletion failed (non-fatal):', (e as Error).message);
      }
    }

    await writeAuditLog(supabase, {
      adminClerkId: admin.clerkId, adminEmail: admin.email,
      action: 'delete_user', targetType: 'user', targetId: clerkId,
      ipAddress: ip,
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
