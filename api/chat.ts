import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createStreamingCompletion } from './_lib/deepseek.js';
import {
  embedQuery,
  searchKnowledgeBase,
  buildRAGPrompt,
  parseToolTriggers,
  cleanResponse,
  generateTitle,
  type KBChunk,
} from './_lib/rag.js';
import {
  containsPII,
  classifyInput,
  scanOutputForPII,
  isJailbreakResponse,
} from './_lib/guardrails.js';

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
    activeTools?: string[];
  } | null;

  const conversationId = body?.conversationId;
  const message = body?.message;
  const userId = body?.userId;
  const activeTools: string[] = body?.activeTools ?? [];

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

  // ── Helper: save a blocked interaction so it survives page refresh ───────────
  const saveBlocked = async (userContent: string, aiContent: string): Promise<string | null> => {
    try {
      await supabaseAdmin.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: userContent,
      });
      const { data } = await supabaseAdmin
        .from('messages')
        .insert({ conversation_id: conversationId, role: 'assistant', content: aiContent })
        .select('id')
        .single();
      return data?.id ?? null;
    } catch {
      return null;
    }
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
    const LIMITS: Record<string, number> = { free: 20, pro: 500, premium: Infinity };
    const limit = LIMITS[user.tier] ?? 50;
    const now = new Date();
    const resetAt = user.daily_message_reset_at ? new Date(user.daily_message_reset_at) : null;
    const effectiveCount = !resetAt || resetAt <= now ? 0 : user.daily_message_count;

    if (limit !== Infinity && effectiveCount >= limit) {
      send({ type: 'error', message: 'Daily message limit reached. Resets at midnight.' });
      return res.end();
    }

    // ── Guardrail: input checks ───────────────────────────────────────────────
    if (containsPII(message.trim())) {
      const aiMsg = "Please don't share sensitive information like passwords, OTPs, or Aadhaar numbers for your own security.";
      const msgId = await saveBlocked('[Message blocked: contains sensitive information]', `⚠️ ${aiMsg}`);
      send({ type: 'error', message: aiMsg });
      send({ type: 'done', messageId: msgId });
      return res.end();
    }

    const classification = await classifyInput(message.trim(), DEEPSEEK_KEY);
    if (classification === 'off_topic') {
      const aiMsg = "I specialise in tech support and cybersecurity. I can't help with that, but feel free to ask about device issues, security threats, or online safety!";
      const msgId = await saveBlocked(message.trim(), `ℹ️ ${aiMsg}`);
      send({ type: 'info', message: aiMsg });
      send({ type: 'done', messageId: msgId });
      return res.end();
    }
    if (classification === 'unsafe') {
      const aiMsg = "I can't help with that request.";
      const msgId = await saveBlocked('[Message blocked: content policy violation]', `⚠️ ${aiMsg}`);
      send({ type: 'error', message: aiMsg });
      send({ type: 'done', messageId: msgId });
      return res.end();
    }
    // classification === 'safe' → continue (no DB write, no rate limit increment on blocked messages)

    // 3. Get chat history (last 10 messages for context)
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    // 4. Check if title needs generating (conversation still has default "New Chat" title)
    const { data: convRow } = await supabaseAdmin
      .from('conversations')
      .select('title')
      .eq('id', conversationId)
      .single();
    const isFirstMessage = !convRow?.title || convRow.title === 'New Chat';

    // 5. Save user message server-side
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message.trim(),
    });

    // 5b. Start title generation concurrently with streaming (uses only the user message).
    // Running it in parallel means it's usually done before streaming ends → zero added latency.
    let titlePromise: Promise<void> | null = null;
    if (isFirstMessage) {
      titlePromise = (async () => {
        const title = await generateTitle(message.trim(), DEEPSEEK_KEY);
        await supabaseAdmin.from('conversations').update({ title }).eq('id', conversationId);
        send({ type: 'title', title });
      })().catch((e) => console.warn('Title generation failed (non-fatal):', (e as Error).message));
    }

    // 5c. Pre-flight tool detection — run security scan BEFORE AI responds so AI has real data
    const PREFLIGHT_PATTERNS: Record<string, RegExp> = {
      url_scan: /https?:\/\/[^\s]{8,}/i,
      breach_check: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      ip_check: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    };
    const BODY_KEY_MAP: Record<string, string> = {
      url_scan: 'url',
      breach_check: 'email',
      ip_check: 'ip',
    };

    let preflightToolResult: Record<string, unknown> | null = null;
    let preflightToolType: string | null = null;
    let preflightParams: string | null = null;

    for (const [toolType, pattern] of Object.entries(PREFLIGHT_PATTERNS)) {
      const match = message.trim().match(pattern);
      if (match) {
        preflightParams = match[0];
        preflightToolType = toolType;
        try {
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';
          const slug = toolType.replace('_', '-');
          const toolRes = await fetch(`${baseUrl}/api/tools/${slug}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [BODY_KEY_MAP[toolType]]: preflightParams }),
          });
          if (toolRes.ok) {
            preflightToolResult = (await toolRes.json()) as Record<string, unknown>;
          }
        } catch (e) {
          console.warn('Pre-flight tool scan failed (non-fatal):', (e as Error).message);
        }
        break;
      }
    }

    // Send pre-flight result immediately so UI can render ToolCard without waiting for stream end
    if (preflightToolResult && preflightToolType) {
      send({ type: 'tool', tool: preflightToolType as 'breach_check' | 'url_scan' | 'ip_check', params: preflightParams! });
      send({ type: 'tool_result', result: preflightToolResult } as never);
    }

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

    // 7b. Inject active tool context into the system message
    const TOOL_CONTEXT: Record<string, string> = {
      threat_intel:
        'USER HAS THREAT INTEL MODE ENABLED: Provide detailed threat intelligence. Include CVE numbers, MITRE ATT&CK technique IDs, CVSS scores, and known IOCs where relevant.',
      certin_mode:
        'USER HAS CERT-In MODE ENABLED: Emphasize CERT-In compliance. Reference the 6-hour mandatory incident reporting window, CERT-In Information Security Practices, and relevant CERT-In advisories.',
      report_builder:
        'USER HAS REPORT BUILDER ENABLED: Structure your response as a formal security report with sections: Executive Summary, Technical Findings, Risk Level, and Recommendations.',
    };
    const extraContext = activeTools
      .map((t) => TOOL_CONTEXT[t])
      .filter(Boolean)
      .join('\n\n');
    if (extraContext && ragMessages[0]?.role === 'system') {
      ragMessages[0] = { ...ragMessages[0], content: ragMessages[0].content + '\n\n' + extraContext };
    }

    // 7c. Inject pre-flight scan result so AI bases its advice on real scan data
    if (preflightToolResult && preflightToolType && ragMessages[0]?.role === 'system') {
      const toolResultContext = `\n\n## Real-Time Security Scan Result\nI already ran a ${preflightToolType.replace('_', ' ')} scan on "${preflightParams}" before responding. Here is the actual scan data — base your advice on this:\n\n${JSON.stringify(preflightToolResult, null, 2)}\n\nUse this real data in your response. Do NOT trigger another tool scan for this item since it is already done.`;
      ragMessages[0] = { ...ragMessages[0], content: ragMessages[0].content + toolResultContext };
    }

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

    // ── Guardrail: output checks ──────────────────────────────────────────────
    let safeContent = scanOutputForPII(fullContent);
    if (isJailbreakResponse(safeContent)) {
      safeContent = 'I can only assist with tech support and cybersecurity topics.';
    }
    const cleanContent = cleanResponse(safeContent);

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

    // 10b. Log tool usage analytics
    if (tools.length > 0) {
      try {
        await supabaseAdmin.from('analytics_events').insert({
          user_id: user.id,
          event_type: 'tool_used',
          event_data: {
            tool_type: tools[0].type,
            params_length: tools[0].params.length,
            conversation_id: conversationId,
          },
        });
      } catch (e) {
        console.warn('Tool analytics failed (non-fatal):', (e as Error).message);
      }
    }

    // 11. Emit tool trigger event if detected (UI renders ToolCard in loading state)
    if (tools.length > 0) {
      send({ type: 'tool', tool: tools[0].type, params: tools[0].params });
    }

    // 12. Await title generation (started concurrently in step 5b — usually already done)
    if (titlePromise) await titlePromise;

    // 13. Increment daily message count
    const isPastReset = !resetAt || resetAt <= now;
    await supabaseAdmin
      .from('users')
      .update({
        daily_message_count: isPastReset ? 1 : effectiveCount + 1,
        daily_message_reset_at: isPastReset ? getTomorrowMidnight() : user.daily_message_reset_at,
      })
      .eq('id', user.id);

    // 13b. Log analytics event for message sent
    try {
      await supabaseAdmin.from('analytics_events').insert({
        user_id: user.id,
        event_type: 'message_sent',
        event_data: {
          conversation_id: conversationId,
          message_length: message.trim().length,
          tools_active: activeTools,
          kb_chunks_found: kbChunks.length,
          tool_triggered: tools.length > 0 ? tools[0].type : null,
          had_kb_context: kbChunks.length > 0,
        },
      });
    } catch (analyticsError) {
      console.warn('Analytics failed (non-fatal):', (analyticsError as Error).message);
    }

    send({ type: 'done', messageId: savedMsg?.id ?? null });
    res.end();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('Chat API error:', msg, error);
    send({ type: 'error', message: `Error: ${msg}` });
    try { res.end(); } catch { /* already ended */ }
  }
}
