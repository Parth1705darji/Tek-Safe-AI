import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const adminEmail = process.env.VITE_ADMIN_EMAIL;
  const requestingEmail = req.headers['x-admin-email'] as string | undefined;

  if (!adminEmail || requestingEmail !== adminEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [
    totalUsers,
    usersToday,
    usersWeek,
    totalMessages,
    messagesToday,
    messagesWeek,
    toolStats,
    feedbackStats,
    recentUsers,
    kbDocuments,
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeek),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('role', 'assistant'),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('role', 'assistant').gte('created_at', startOfToday),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('role', 'assistant').gte('created_at', startOfWeek),
    supabase.from('analytics_events').select('event_data').eq('event_type', 'tool_used'),
    supabase.from('messages').select('feedback').eq('role', 'assistant').not('feedback', 'is', null),
    supabase.from('users').select('id, clerk_id, email, display_name, tier, role, daily_message_count, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('kb_documents').select('id, title, category, subcategory, tags, created_at').order('created_at', { ascending: false }),
  ]);

  const toolCounts: Record<string, number> = {};
  for (const event of (toolStats.data ?? [])) {
    const tool = (event.event_data as Record<string, string>)?.tool_type;
    if (tool) toolCounts[tool] = (toolCounts[tool] ?? 0) + 1;
  }

  const upCount = (feedbackStats.data ?? []).filter((m) => m.feedback === 'up').length;
  const downCount = (feedbackStats.data ?? []).filter((m) => m.feedback === 'down').length;

  return res.status(200).json({
    users: {
      total: totalUsers.count ?? 0,
      today: usersToday.count ?? 0,
      thisWeek: usersWeek.count ?? 0,
    },
    messages: {
      total: totalMessages.count ?? 0,
      today: messagesToday.count ?? 0,
      thisWeek: messagesWeek.count ?? 0,
    },
    tools: toolCounts,
    feedback: { up: upCount, down: downCount },
    recentUsers: recentUsers.data ?? [],
    kbDocuments: kbDocuments.data ?? [],
  });
}
