import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const id = req.query.id as string | undefined;

  // DELETE /api/conversations?id=<conversationId>
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'Missing conversation id' });

    const { error: msgError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('conversation_id', id);

    if (msgError) {
      console.error('Failed to delete messages:', msgError.message);
      return res.status(500).json({ error: msgError.message });
    }

    const { error: convError } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('id', id);

    if (convError) {
      console.error('Failed to delete conversation:', convError.message);
      return res.status(500).json({ error: convError.message });
    }

    return res.status(200).json({ deleted: true });
  }

  // PATCH /api/conversations?id=<conversationId>
  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'Missing conversation id' });

    const body = req.body as { title?: string };
    if (!body?.title?.trim()) {
      return res.status(400).json({ error: 'Missing title in request body' });
    }

    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ title: body.title.trim() })
      .eq('id', id);

    if (error) {
      console.error('Failed to rename conversation:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ updated: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
