import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import type { Message, KBSource } from '../types';
// ─── SSE event shapes sent by api/chat.ts ─────────────────────────────────────
type SSEEvent =
  | { type: 'token'; content: string }
  | { type: 'sources'; sources: KBSource[] }
  | { type: 'tool'; tool: Message['tool_used']; params: string }
  | { type: 'title'; title: string }
  | { type: 'done'; messageId: string | null }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string };
const TOOL_ENDPOINT: Record<string, string> = {
  breach_check: 'breach-check',
  url_scan: 'url-scan',
  ip_check: 'ip-check',
};
// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useChat(conversationId?: string, clerkUserId?: string, activeTools?: string[]) {
  const supabase = useSupabase();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Load persisted messages when conversation changes.
  // Always clear immediately on conversationId change to prevent cross-chat
  // message contamination. Optimistic messages for a new chat are managed
  // by ChatPage which defers sendMessage until after navigation settles.
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    // Clear immediately so the previous chat's messages never bleed into the new one
    setMessages([]);
    let cancelled = false;
    const load = async () => {
      const result = (await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })) as {
        data: Message[] | null;
        error: unknown;
      };
      // Only overwrite if there are persisted messages — avoids wiping
      // optimistic messages that sendMessage already added for a brand-new
      // conversation whose DB rows don't exist yet when load() resolves.
      if (!cancelled && result.data && result.data.length > 0) {
        setMessages(result.data);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [conversationId, supabase]);
  const sendMessage = useCallback(
    async (content: string, convId: string) => {
      if (!content.trim() || isStreaming || !clerkUserId) return;
      // Optimistic user message — displayed immediately
      const optimisticUserMsg: Message = {
        id: crypto.randomUUID(),
        conversation_id: convId,
        role: 'user',
        content: content.trim(),
        sources: [],
        tool_used: null,
        tool_result: null,
        feedback: null,
        feedback_text: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);
      setIsLoading(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      // Placeholder AI message — filled in as tokens stream
      const aiMsgLocalId = crypto.randomUUID();
      const aiMsg: Message = {
        id: aiMsgLocalId,
        conversation_id: convId,
        role: 'assistant',
        content: '',
        sources: [],
        tool_used: null,
        tool_result: null,
        feedback: null,
        feedback_text: null,
        created_at: new Date().toISOString(),
      };
      // Track tool trigger and real DB ID within this send cycle
      let pendingTool: { tool: Message['tool_used']; params: string } | null = null;
      let finalMsgId: string = aiMsgLocalId;
      // Flag: did we add the AI placeholder to state yet?
      let aiMsgAdded = false;
      // Layer 1: Client-side PII warning (non-blocking — server also enforces this)
      const CLIENT_PII = [
        /\bpassword\s*(is|[:=])\s*\S+/i,
        /\bpwd\s*(is|[:=])\s*\S+/i,
        /\bpasscode\s*(is|[:=])\s*\S+/i,
        /\b(otp|one[\s-]time\s*pass(?:word|code)?)\s*(is|[:=])\s*\d{4,8}/i,
        /\bpin\s*(is|[:=])\s*\d{4,8}/i,
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
        /\b(?:\d[ -]?){13,19}\b/,
      ];
      const piiWarning = CLIENT_PII.some((re) => re.test(content.trim()))
        ? "⚠️ For your safety, please don't share passwords, OTPs, or Aadhaar numbers. Please rephrase without sensitive data."
        : '';
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: convId,
            message: content.trim(),
            userId: clerkUserId,
            activeTools: activeTools ?? [],
          }),
          signal: ctrl.signal,
        });
        if (!response.ok || !response.body) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`API error ${response.status}${errorText ? `: ${errorText.slice(0, 200)}` : ''}`);
        }
        // Valid streaming response confirmed — add AI placeholder now.
        setMessages((prev) => [...prev, { ...aiMsg, content: piiWarning }]);
        aiMsgAdded = true;
        setIsLoading(false);
        setIsStreaming(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            try {
              const event = JSON.parse(raw) as SSEEvent;
              switch (event.type) {
                case 'token':
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgLocalId
                        ? { ...m, content: m.content + event.content }
                        : m
                    )
                  );
                  break;
                case 'sources':
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgLocalId ? { ...m, sources: event.sources } : m
                    )
                  );
                  break;
                case 'tool':
                  pendingTool = { tool: event.tool, params: event.params };
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgLocalId ? { ...m, tool_used: event.tool } : m
                    )
                  );
                  break;
                case 'title':
                  window.dispatchEvent(
                    new CustomEvent('teksafe:title-update', {
                      detail: { conversationId: convId, title: event.title },
                    })
                  );
                  break;
                case 'done':
                  if (event.messageId) {
                    finalMsgId = event.messageId;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === aiMsgLocalId ? { ...m, id: event.messageId! } : m
                      )
                    );
                  }
                  break;
                case 'error':
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgLocalId
                        ? { ...m, content: `⚠️ ${event.message}` }
                        : m
                    )
                  );
                  break;
                case 'info':
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgLocalId
                        ? { ...m, content: `ℹ️ ${event.message}` }
                        : m
                    )
                  );
                  break;
              }
            } catch {
              // Skip malformed SSE events
            }
          }
        }
        // ── Execute security tool API (non-fatal) ───────────────────────────
        if (pendingTool?.tool) {
          const endpoint = TOOL_ENDPOINT[pendingTool.tool];
          const TOOL_BODY_KEY: Record<string, string> = {
            breach_check: 'email',
            url_scan: 'url',
            ip_check: 'ip',
          };
          const bodyKey = TOOL_BODY_KEY[pendingTool.tool] ?? 'params';
          try {
            const toolRes = await fetch(`/api/tools/${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [bodyKey]: pendingTool.params }),
            });
            if (toolRes.ok) {
              const toolResult = await toolRes.json() as Record<string, unknown>;
              const capturedId = finalMsgId;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === capturedId || m.id === aiMsgLocalId
                    ? { ...m, tool_result: toolResult }
                    : m
                )
              );
              // Persist tool_result to DB
              await supabase
                .from('messages')
                .update({ tool_result: toolResult })
                .eq('id', capturedId);
            }
          } catch (e) {
            console.warn('Tool execution failed (non-fatal):', (e as Error).message);
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          const errMsg = (error as Error).message ?? '';
          const isApiDown = errMsg.includes('404') || errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError');
          const displayMsg = isApiDown
            ? '⚠️ Could not reach the server. Make sure you are running `vercel dev` (not `vite`), then refresh.'
            : `⚠️ ${errMsg || 'Something went wrong. Please try again.'}`;
          console.error('Chat API error:', errMsg);
          setMessages((prev) => {
            if (aiMsgAdded) {
              return prev.map((m) => m.id === aiMsgLocalId ? { ...m, content: displayMsg } : m);
            }
            // Fetch failed before we added the placeholder — push error message directly
            return [...prev, { ...aiMsg, content: displayMsg }];
          });
        }
      } finally {
        setIsStreaming(false);
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [isStreaming, clerkUserId, supabase]
  );
  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setIsLoading(false);
  }, []);
  const submitFeedback = useCallback(
    async (messageId: string, feedback: 'up' | 'down', feedbackText?: string) => {
      // Optimistic update first
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, feedback, feedback_text: feedbackText ?? null }
            : m
        )
      );
      // Persist via API endpoint (which also logs analytics)
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, feedback, feedbackText, userId: clerkUserId }),
        });
      } catch (e) {
        console.warn('Feedback save failed (non-fatal):', (e as Error).message);
      }
    },
    [clerkUserId]
  );
  return { messages, isLoading, isStreaming, sendMessage, submitFeedback, stopGenerating };
}
