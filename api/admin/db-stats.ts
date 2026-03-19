import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

  try {
    const [users, conversations, messages, kbDocs, kbEmbeddings, analytics] =
      await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('conversations').select('id', { count: 'exact', head: true }),
        supabase.from('messages').select('id', { count: 'exact', head: true }),
        supabase.from('kb_documents').select('id', { count: 'exact', head: true }),
        supabase.from('kb_embeddings').select('id', { count: 'exact', head: true }),
        supabase.from('analytics_events').select('id', { count: 'exact', head: true }),
      ]);

    return res.status(200).json({
      tables: {
        users: users.count ?? 0,
        conversations: conversations.count ?? 0,
        messages: messages.count ?? 0,
        kb_documents: kbDocs.count ?? 0,
        kb_embeddings: kbEmbeddings.count ?? 0,
        analytics_events: analytics.count ?? 0,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}
