import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest, sendAuthError } from '../_lib/adminAuth.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    await verifyAdminRequest(req);
  } catch (e) {
    return sendAuthError(res, e);
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 86400000).toISOString();

  // ?include=db returns database table row counts (merged from db-stats endpoint)
  if (req.query.include === 'db') {
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
  }

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

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
    tsMessages,
    tsUsers,
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
    supabase.from('messages').select('created_at').eq('role', 'assistant').gte('created_at', thirtyDaysAgo),
    supabase.from('users').select('created_at').gte('created_at', thirtyDaysAgo),
  ]);

  const toolCounts: Record<string, number> = {};
  for (const event of (toolStats.data ?? [])) {
    const tool = (event.event_data as Record<string, string>)?.tool_type;
    if (tool) toolCounts[tool] = (toolCounts[tool] ?? 0) + 1;
  }

  const upCount = (feedbackStats.data ?? []).filter((m) => m.feedback === 'up').length;
  const downCount = (feedbackStats.data ?? []).filter((m) => m.feedback === 'down').length;

  // Build 30-day time series
  const groupByDay = (items: { created_at: string }[]) => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const day = item.created_at.slice(0, 10);
      counts[day] = (counts[day] ?? 0) + 1;
    }
    const result: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const day = d.toISOString().slice(0, 10);
      result.push({ date: day, count: counts[day] ?? 0 });
    }
    return result;
  };

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
    timeSeries: {
      messages: groupByDay(tsMessages.data ?? []),
      users: groupByDay(tsUsers.data ?? []),
    },
  });
}
