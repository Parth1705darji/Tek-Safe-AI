import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = req.body as {
    messageId?: string;
    feedback?: 'up' | 'down';
    feedbackText?: string;
    userId?: string;
  };

  const { messageId, feedback, feedbackText, userId } = body;

  if (!messageId || !feedback) {
    return res.status(400).json({ error: 'Missing required fields: messageId and feedback' });
  }

  if (feedback !== 'up' && feedback !== 'down') {
    return res.status(400).json({ error: 'feedback must be "up" or "down"' });
  }

  const { error: updateError } = await supabaseAdmin
    .from('messages')
    .update({
      feedback,
      feedback_text: feedbackText?.trim() ?? null,
    })
    .eq('id', messageId);

  if (updateError) {
    console.error('Failed to save feedback:', updateError.message);
    return res.status(500).json({ error: updateError.message });
  }

  // Log analytics event — non-fatal
  try {
    let dbUserId: string | null = null;
    if (userId) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('clerk_id', userId)
        .single();
      dbUserId = user?.id ?? null;
    }

    await supabaseAdmin.from('analytics_events').insert({
      user_id: dbUserId,
      event_type: 'feedback_given',
      event_data: {
        message_id: messageId,
        feedback,
        has_text: !!feedbackText?.trim(),
      },
    });
  } catch (e) {
    console.warn('Analytics insert failed (non-fatal):', (e as Error).message);
  }

  return res.status(200).json({ ok: true });
}
