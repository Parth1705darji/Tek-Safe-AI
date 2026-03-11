import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createStreamingCompletion } from './_lib/deepseek';
import {
  embedQuery,
  searchKnowledgeBase,
  buildRAGPrompt,
  parseToolTriggers,
  cleanResponse,
  generateTitle,
  type KBChunk,
} from './_lib/rag';

// Body parser enabled (default for Vercel Node functions)
export const config = { api: { bodyParser: true } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTomorrowMidnight(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Validate env vars early so errors are descriptive
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env vars');
    return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' });
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('Missing DEEPSEEK_API_KEY');
    return res.status(500).json({ error: 'Server misconfiguration: missing DEEPSEEK_API_KEY' });
  }

  const body = req.body as {
    conversationId?: string;
    message?: string;
    userId?: string;
  } | null;

  const conversationId = body?.conversationId;
  const message = body?.message;
  const userId = body?.userId;

  if (!conversationId || !message?.trim() || !userId) {
    return res.status(400).json({ error: 'Missing required fields', body: JSON.stringify(body) });
  }

  // Initialise clients inside handler so missing env vars produce clear errors above
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY!;
  const OPENAI_KEY = process.env.OPENAI_API_KEY ?? '';

  // ── SSE headers ──────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  try { res.flushHeaders(); } catch { /* socket may already be closed */ }

  const send = (data: object) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* client disconnected */ }
  };

  try {
    // 1. Resolve Supabase user from Clerk ID
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, tier, daily_message_count, daily_message_reset_at')
      .eq('clerk_id', userId)
      .single();

    if (!user) {
      send({ type: 'error', message: 'User not found. Please refresh and try again.' });
      return res.end();
    }

    // 2. Check rate limit
    const LIMITS: Record<string, number> = { free: 50, premium: Infinity };
    const limit = LIMITS[user.tier] ?? 50;
    const now = new Date();
    const resetAt = user.daily_message_reset_at ? new Date(user.daily_message_reset_at) : null;
    const effectiveCount = !resetAt || resetAt <= now ? 0 : user.daily_message_count;

    if (limit !== Infinity && effectiveCount >= limit) {
      send({ type: 'error', message: 'Daily message limit reached. Resets at midnight.' });
      return res.end();
    }

    // 3. Get chat history (last 10 messages for context)
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    // 4. Check if this is the first message (for auto-title)
    const { count: msgCount } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);
    const isFirstMessage = (msgCount ?? 0) === 0;

    // 5. Save user message server-side
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message.trim(),
    });

    // 6. Embed query + vector search KB (non-fatal if fails)
    let kbChunks: KBChunk[] = [];
    try {
      if (OPENAI_KEY && OPENAI_KEY !== 'your_key_here') {
        const embedding = await embedQuery(message.trim(), OPENAI_KEY);
        kbChunks = await searchKnowledgeBase(embedding, supabaseAdmin);
      }
    } catch (e) {
      console.warn('KB search failed (non-fatal):', (e as Error).message);
    }

    if (kbChunks.length > 0) {
      send({
        type: 'sources',
        sources: kbChunks.map((c) => ({
          document_id: c.document_id,
          title: c.document_title,
          chunk_text: c.chunk_text,
          similarity: c.similarity,
        })),
      });
    }

    // 7. Build RAG prompt
    const ragMessages = buildRAGPrompt(kbChunks, history ?? [], message.trim());

    // 8. Call DeepSeek with streaming
    const streamRes = await createStreamingCompletion(
      { messages: ragMessages, temperature: 0.7, max_tokens: 2000 },
      DEEPSEEK_KEY
    );

    const reader = streamRes.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() ?? ''; // Keep any incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;

        try {
          const parsed = JSON.parse(raw) as {
            choices: Array<{ delta: { content?: string }; finish_reason?: string | null }>;
          };
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            fullContent += token;
            send({ type: 'token', content: token });
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }

    // 9. Parse tool triggers and clean response text
    const tools = parseToolTriggers(fullContent);
    const cleanContent = cleanResponse(fullContent);

    // 10. Save AI message to DB
    const sources = kbChunks.map((c) => ({
      document_id: c.document_id,
      title: c.document_title,
      chunk_text: c.chunk_text,
      similarity: c.similarity,
    }));

    const { data: savedMsg } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: cleanContent,
        sources,
        tool_used: tools.length > 0 ? tools[0].type : null,
        tool_result: null, // Security API execution handled in Step 6
      })
      .select('id')
      .single();

    // 11. Emit tool trigger event if detected (UI renders ToolCard in loading state)
    if (tools.length > 0) {
      send({ type: 'tool', tool: tools[0].type, params: tools[0].params });
    }

    // 12. Auto-generate conversation title on first message
    if (isFirstMessage) {
      try {
        const title = await generateTitle(message.trim(), DEEPSEEK_KEY);
        await supabaseAdmin
          .from('conversations')
          .update({ title })
          .eq('id', conversationId);
        send({ type: 'title', title });
      } catch (e) {
        console.warn('Title generation failed (non-fatal):', (e as Error).message);
      }
    }

    // 13. Increment daily message count
    const isPastReset = !resetAt || resetAt <= now;
    await supabaseAdmin
      .from('users')
      .update({
        daily_message_count: isPastReset ? 1 : effectiveCount + 1,
        daily_message_reset_at: isPastReset ? getTomorrowMidnight() : user.daily_message_reset_at,
      })
      .eq('id', user.id);

    send({ type: 'done', messageId: savedMsg?.id ?? null });
    res.end();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('Chat API error:', msg, error);
    send({ type: 'error', message: `Error: ${msg}` });
    try { res.end(); } catch { /* already ended */ }
  }
}
