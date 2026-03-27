import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest, sendAuthError } from '../_lib/adminAuth.js';

export const config = { api: { bodyParser: true } };

const PAGE_SIZE = 20;

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

  // ── Thread view: GET /api/admin/conversations?id=xxx ──────────────────────
  const id = req.query.id as string | undefined;
  if (id) {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, role, content, tool_used, sources, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    // Get conversation metadata
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, title, user_id, created_at')
      .eq('id', id)
      .single();

    let user = null;
    if (conv?.user_id) {
      const { data: u } = await supabase
        .from('users')
        .select('id, clerk_id, email, display_name, avatar_url')
        .eq('id', conv.user_id)
        .single();
      user = u;
    }

    return res.status(200).json({ conversation: conv, user, messages: messages ?? [] });
  }

  // ── List view: GET /api/admin/conversations?page=1&search=xxx&userId=xxx ──
  const page = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
  const search = (req.query.search as string | undefined)?.trim();
  const clerkId = req.query.userId as string | undefined;

  // Resolve clerkId → internal user ID
  let userIdFilter: string[] | null = null;

  if (clerkId) {
    const { data: dbUser } = await supabase
      .from('users').select('id').eq('clerk_id', clerkId).single();
    userIdFilter = dbUser ? [dbUser.id] : [];
  } else if (search) {
    const { data: matchedUsers } = await supabase
      .from('users')
      .select('id')
      .or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    userIdFilter = (matchedUsers ?? []).map(u => u.id);
  }

  // Early-return when search matched no users
  if (userIdFilter !== null && userIdFilter.length === 0) {
    return res.status(200).json({ conversations: [], total: 0, page, totalPages: 0 });
  }

  let query = supabase
    .from('conversations')
    .select('id, title, user_id, created_at, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (userIdFilter !== null) {
    query = query.in('user_id', userIdFilter);
  }

  const { data: convs, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Fetch user info for all returned conversations
  const uniqueUserIds = [...new Set((convs ?? []).map(c => c.user_id))];
  const { data: users } = uniqueUserIds.length > 0
    ? await supabase
        .from('users')
        .select('id, clerk_id, email, display_name, avatar_url')
        .in('id', uniqueUserIds)
    : { data: [] };

  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]));

  // Fetch message counts per conversation
  const convIds = (convs ?? []).map(c => c.id);
  const messageCounts: Record<string, number> = {};
  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convIds);
    for (const m of (msgs ?? [])) {
      messageCounts[m.conversation_id] = (messageCounts[m.conversation_id] ?? 0) + 1;
    }
  }

  const conversations = (convs ?? []).map(c => ({
    ...c,
    user: userMap[c.user_id] ?? null,
    message_count: messageCounts[c.id] ?? 0,
  }));

  return res.status(200).json({
    conversations,
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
